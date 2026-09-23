from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

import duckdb
import polars as pl


REQUIRED_COLUMNS = {
    "ts_utc",
    "run_id",
    "technology",
    "machine_id",
    "machine_revision",
    "classification",
    "model_id",
    "sample_index",
    "wind_speed_mps",
    "wind_direction_deg",
    "head_yaw_deg",
    "yaw_error_deg",
    "foil_phase_deg",
    "power_proxy_kw",
    "vibration_proxy",
}


class PipelineConfigurationError(RuntimeError):
    pass


class PipelineQualityError(RuntimeError):
    pass


@dataclass(frozen=True)
class PipelineSummary:
    run_id: str
    bronze_rows: int
    silver_rows: int
    gold_rows: int
    target: str
    classification: str


def connect_analytical_store(target: str | None = None) -> duckdb.DuckDBPyConnection:
    """Connect to local DuckDB or MotherDuck without embedding credentials.

    Examples:
      local: /data/foil_oracle.duckdb
      MotherDuck: md:foil_oracle_lake

    MotherDuck authentication is provided through MOTHERDUCK_TOKEN.
    """
    resolved = target or os.getenv("FOIL_DUCKDB_TARGET") or "/tmp/foil_oracle.duckdb"
    if resolved.startswith("md:") and not os.getenv("MOTHERDUCK_TOKEN"):
        raise PipelineConfigurationError(
            "MOTHERDUCK_TOKEN is required when FOIL_DUCKDB_TARGET uses the md: protocol."
        )
    return duckdb.connect(resolved)


def _validate_frame(frame: pl.DataFrame) -> None:
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise PipelineQualityError(f"Missing telemetry columns: {sorted(missing)}")

    if frame.is_empty():
        raise PipelineQualityError("Telemetry frame is empty.")

    if frame.select(pl.col("run_id").n_unique()).item() != 1:
        raise PipelineQualityError("One pipeline invocation must contain exactly one run_id.")

    if frame.select(pl.col("classification").n_unique()).item() != 1:
        raise PipelineQualityError("Telemetry classification must be uniform for a run.")

    if frame.select(pl.col("classification").first()).item() != "SYNTHETIC":
        raise PipelineQualityError(
            "This V1 pipeline accepts SYNTHETIC inputs only; measured-data ingestion requires a separate contract."
        )

    if frame.filter(pl.col("wind_speed_mps") < 0).height:
        raise PipelineQualityError("wind_speed_mps cannot be negative.")

    if frame.filter(pl.col("foil_phase_deg") != 90.0).height:
        raise PipelineQualityError(
            "Current WIND baseline must carry the source-backed 90-degree inter-foil phase."
        )

    duplicate_count = frame.select(
        pl.struct(["run_id", "sample_index"]).is_duplicated().sum()
    ).item()
    if duplicate_count:
        raise PipelineQualityError("Duplicate run_id/sample_index telemetry rows detected.")


def _ensure_schemas(connection: duckdb.DuckDBPyConnection) -> None:
    for schema in ("bronze", "silver", "gold"):
        connection.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")


def _replace_run(
    connection: duckdb.DuckDBPyConnection,
    *,
    table: str,
    frame: pl.DataFrame,
    run_id: str,
) -> int:
    relation_name = "_foil_stage"
    connection.register(relation_name, frame)
    try:
        connection.execute(
            f"CREATE TABLE IF NOT EXISTS {table} AS "
            f"SELECT * FROM {relation_name} WHERE 1 = 0"
        )
        connection.execute(f"DELETE FROM {table} WHERE run_id = ?", [run_id])
        connection.execute(f"INSERT INTO {table} SELECT * FROM {relation_name}")
        return int(
            connection.execute(
                f"SELECT COUNT(*) FROM {table} WHERE run_id = ?", [run_id]
            ).fetchone()[0]
        )
    finally:
        connection.unregister(relation_name)


def publish_bronze(
    connection: duckdb.DuckDBPyConnection,
    parquet_path: str | Path,
) -> tuple[str, int]:
    frame = pl.read_parquet(parquet_path)
    _validate_frame(frame)
    run_id = str(frame.select(pl.col("run_id").first()).item())
    rows = _replace_run(
        connection,
        table="bronze.wind_telemetry",
        frame=frame,
        run_id=run_id,
    )
    return run_id, rows


def publish_silver(
    connection: duckdb.DuckDBPyConnection,
    run_id: str,
) -> int:
    bronze = connection.execute(
        "SELECT * FROM bronze.wind_telemetry WHERE run_id = ? ORDER BY sample_index",
        [run_id],
    ).pl()
    _validate_frame(bronze)

    silver = (
        bronze
        .with_columns(
            pl.col("ts_utc").cast(pl.Datetime(time_zone="UTC")),
            pl.col("wind_speed_mps").cast(pl.Float64),
            pl.col("power_proxy_kw").cast(pl.Float64),
            pl.col("vibration_proxy").cast(pl.Float64),
            pl.col("yaw_error_deg").abs().alias("yaw_error_abs_deg"),
        )
        .with_columns(
            pl.when(pl.col("yaw_error_abs_deg") <= 10.0)
            .then(pl.lit("ALIGNED_PROXY"))
            .otherwise(pl.lit("MISALIGNED_PROXY"))
            .alias("yaw_alignment_state")
        )
    )
    return _replace_run(
        connection,
        table="silver.wind_telemetry",
        frame=silver,
        run_id=run_id,
    )


def publish_gold(
    connection: duckdb.DuckDBPyConnection,
    run_id: str,
) -> int:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS gold.wind_run_summary (
            run_id VARCHAR,
            technology VARCHAR,
            machine_id VARCHAR,
            machine_revision VARCHAR,
            classification VARCHAR,
            model_id VARCHAR,
            sample_count BIGINT,
            started_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            mean_wind_speed_mps DOUBLE,
            mean_power_proxy_kw DOUBLE,
            peak_power_proxy_kw DOUBLE,
            mean_vibration_proxy DOUBLE,
            mean_abs_yaw_error_deg DOUBLE,
            foil_phase_deg DOUBLE,
            quality_status VARCHAR
        )
        """
    )
    connection.execute("DELETE FROM gold.wind_run_summary WHERE run_id = ?", [run_id])
    connection.execute(
        """
        INSERT INTO gold.wind_run_summary
        SELECT
            run_id,
            any_value(technology),
            any_value(machine_id),
            any_value(machine_revision),
            any_value(classification),
            any_value(model_id),
            count(*),
            min(ts_utc),
            max(ts_utc),
            avg(wind_speed_mps),
            avg(power_proxy_kw),
            max(power_proxy_kw),
            avg(vibration_proxy),
            avg(yaw_error_abs_deg),
            any_value(foil_phase_deg),
            'PASS_SYNTHETIC_PIPELINE'
        FROM silver.wind_telemetry
        WHERE run_id = ?
        GROUP BY run_id
        """,
        [run_id],
    )
    return int(
        connection.execute(
            "SELECT COUNT(*) FROM gold.wind_run_summary WHERE run_id = ?", [run_id]
        ).fetchone()[0]
    )


def read_gold_summary(
    connection: duckdb.DuckDBPyConnection,
    run_id: str,
) -> dict[str, Any]:
    cursor = connection.execute(
        "SELECT * FROM gold.wind_run_summary WHERE run_id = ?", [run_id]
    )
    row = cursor.fetchone()
    if row is None:
        raise PipelineQualityError(f"Gold summary not found for run {run_id}.")
    return dict(zip([item[0] for item in cursor.description], row, strict=True))


def run_medallion_pipeline(
    parquet_path: str | Path,
    *,
    target: str | None = None,
) -> PipelineSummary:
    connection = connect_analytical_store(target)
    resolved_target = target or os.getenv("FOIL_DUCKDB_TARGET") or "/tmp/foil_oracle.duckdb"
    try:
        _ensure_schemas(connection)
        run_id, bronze_rows = publish_bronze(connection, parquet_path)
        silver_rows = publish_silver(connection, run_id)
        gold_rows = publish_gold(connection, run_id)
        summary = read_gold_summary(connection, run_id)
        return PipelineSummary(
            run_id=run_id,
            bronze_rows=bronze_rows,
            silver_rows=silver_rows,
            gold_rows=gold_rows,
            target=resolved_target,
            classification=str(summary["classification"]),
        )
    finally:
        connection.close()
