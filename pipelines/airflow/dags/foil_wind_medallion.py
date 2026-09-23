from __future__ import annotations

from datetime import UTC, datetime
import os
from pathlib import Path
import tempfile
import uuid

from airflow.sdk import dag, task

from foil_pipeline.medallion import run_medallion_pipeline
from foil_pipeline.synthetic import generate_synthetic_wind_run


@dag(
    dag_id="foil_wind_medallion",
    description="Synthetic WIND -> Polars -> DuckDB/DuckLake -> MotherDuck medallion pipeline",
    schedule=None,
    start_date=datetime(2026, 9, 22, tzinfo=UTC),
    catchup=False,
    max_active_runs=1,
    tags=["foil", "wind", "polars", "duckdb", "motherduck", "synthetic"],
)
def foil_wind_medallion():
    @task
    def generate_and_publish() -> dict[str, object]:
        run_id = "RUN-WIND-" + datetime.now(UTC).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]
        with tempfile.TemporaryDirectory(prefix="foil-wind-") as temp_dir:
            generated = generate_synthetic_wind_run(
                Path(temp_dir),
                run_id=run_id,
                samples=int(os.getenv("FOIL_SYNTHETIC_SAMPLES", "300")),
                sample_period_seconds=int(os.getenv("FOIL_SAMPLE_PERIOD_SECONDS", "1")),
                seed=int(os.getenv("FOIL_SYNTHETIC_SEED", "20260922")),
            )
            summary = run_medallion_pipeline(
                generated.parquet_path,
                target=os.getenv("FOIL_DUCKDB_TARGET", "md:foil_oracle_lake"),
            )
            return {
                "run_id": summary.run_id,
                "classification": summary.classification,
                "bronze_rows": summary.bronze_rows,
                "silver_rows": summary.silver_rows,
                "gold_rows": summary.gold_rows,
                "target": summary.target,
            }

    generate_and_publish()


foil_wind_medallion()
