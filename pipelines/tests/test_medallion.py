from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl
import pytest

from foil_pipeline.medallion import PipelineQualityError, run_medallion_pipeline
from foil_pipeline.synthetic import generate_synthetic_wind_run


def test_synthetic_wind_pipeline_reaches_gold(tmp_path: Path) -> None:
    generated = generate_synthetic_wind_run(
        tmp_path / "raw",
        run_id="RUN-WIND-TEST-001",
        samples=48,
        seed=42,
    )
    database = tmp_path / "foil.duckdb"

    result = run_medallion_pipeline(generated.parquet_path, target=str(database))

    assert result.run_id == "RUN-WIND-TEST-001"
    assert result.bronze_rows == 48
    assert result.silver_rows == 48
    assert result.gold_rows == 1
    assert result.classification == "SYNTHETIC"

    connection = duckdb.connect(str(database), read_only=True)
    try:
        gold = connection.execute(
            "SELECT sample_count, foil_phase_deg, quality_status, classification "
            "FROM gold.wind_run_summary WHERE run_id = 'RUN-WIND-TEST-001'"
        ).fetchone()
    finally:
        connection.close()

    assert gold == (48, 90.0, "PASS_SYNTHETIC_PIPELINE", "SYNTHETIC")


def test_pipeline_rejects_non_synthetic_input(tmp_path: Path) -> None:
    generated = generate_synthetic_wind_run(
        tmp_path / "raw",
        run_id="RUN-WIND-TEST-002",
        samples=8,
    )
    frame = pl.read_parquet(generated.parquet_path).with_columns(
        pl.lit("MEASURED").alias("classification")
    )
    invalid = tmp_path / "invalid.parquet"
    frame.write_parquet(invalid)

    with pytest.raises(PipelineQualityError, match="SYNTHETIC"):
        run_medallion_pipeline(invalid, target=str(tmp_path / "invalid.duckdb"))


def test_pipeline_rejects_non_baseline_phase(tmp_path: Path) -> None:
    generated = generate_synthetic_wind_run(
        tmp_path / "raw",
        run_id="RUN-WIND-TEST-003",
        samples=8,
    )
    frame = pl.read_parquet(generated.parquet_path).with_columns(
        pl.lit(30.0).alias("foil_phase_deg")
    )
    invalid = tmp_path / "invalid-phase.parquet"
    frame.write_parquet(invalid)

    with pytest.raises(PipelineQualityError, match="90-degree"):
        run_medallion_pipeline(invalid, target=str(tmp_path / "phase.duckdb"))
