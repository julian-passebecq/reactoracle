from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import json
import math
from pathlib import Path
import random

import polars as pl


WIND_MACHINE_ID = "MACHINE-WIND-001"
WIND_MACHINE_REVISION = "2026-09-21.2"
SOURCE_BACKED_PHASE_DEG = 90.0
CLASSIFICATION = "SYNTHETIC"
MODEL_ID = "synthetic-wind-proxy-v1"


@dataclass(frozen=True)
class SyntheticWindRun:
    run_id: str
    parquet_path: Path
    manifest_path: Path
    sample_count: int


def _angle_error_deg(target: float, actual: float) -> float:
    return ((target - actual + 180.0) % 360.0) - 180.0


def generate_synthetic_wind_run(
    output_dir: str | Path,
    *,
    run_id: str,
    samples: int = 120,
    sample_period_seconds: int = 1,
    seed: int = 20260922,
) -> SyntheticWindRun:
    """Generate deterministic Wind telemetry for software/data-pipeline testing.

    This is not measured machine data and it is not a validated Wind performance
    model. The 90-degree inter-foil phase is carried as source-backed project
    context; numeric power/vibration/yaw-response values are synthetic proxies.
    """
    if samples <= 0:
        raise ValueError("samples must be positive")
    if sample_period_seconds <= 0:
        raise ValueError("sample_period_seconds must be positive")
    if not run_id.strip():
        raise ValueError("run_id must be non-empty")

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    start = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)

    rows: list[dict[str, object]] = []
    head_yaw = 218.0

    for index in range(samples):
        timestamp = start + timedelta(seconds=index * sample_period_seconds)
        cycle = index / max(samples - 1, 1)
        wind_speed = max(
            0.0,
            7.8
            + 1.6 * math.sin(cycle * math.tau * 1.3)
            + rng.uniform(-0.35, 0.35),
        )
        wind_direction = (
            220.0
            + 14.0 * math.sin(cycle * math.tau * 0.7)
            + rng.uniform(-1.2, 1.2)
        ) % 360.0

        # Software-only yaw response proxy. No physical response constant is
        # asserted as engineering truth.
        yaw_delta = _angle_error_deg(wind_direction, head_yaw)
        head_yaw = (head_yaw + yaw_delta * 0.22) % 360.0
        yaw_error = _angle_error_deg(wind_direction, head_yaw)

        # Deliberately labelled proxy, not a validated power curve or measured Cp.
        power_proxy_kw = max(
            0.0,
            0.015 * wind_speed**3 * (1.0 + rng.uniform(-0.04, 0.04)),
        )
        vibration_proxy = max(
            0.0,
            0.08 + 0.015 * wind_speed + rng.uniform(-0.01, 0.01),
        )

        rows.append(
            {
                "ts_utc": timestamp,
                "run_id": run_id,
                "technology": "WIND",
                "machine_id": WIND_MACHINE_ID,
                "machine_revision": WIND_MACHINE_REVISION,
                "classification": CLASSIFICATION,
                "model_id": MODEL_ID,
                "sample_index": index,
                "wind_speed_mps": round(wind_speed, 6),
                "wind_direction_deg": round(wind_direction, 6),
                "head_yaw_deg": round(head_yaw, 6),
                "yaw_error_deg": round(yaw_error, 6),
                "foil_phase_deg": SOURCE_BACKED_PHASE_DEG,
                "power_proxy_kw": round(power_proxy_kw, 6),
                "vibration_proxy": round(vibration_proxy, 6),
            }
        )

    frame = pl.DataFrame(rows)
    parquet_path = output / f"{run_id}.parquet"
    manifest_path = output / f"{run_id}.manifest.json"
    frame.write_parquet(parquet_path)

    manifest = {
        "schema_version": 1,
        "run_id": run_id,
        "technology": "WIND",
        "machine_id": WIND_MACHINE_ID,
        "machine_revision": WIND_MACHINE_REVISION,
        "classification": CLASSIFICATION,
        "sample_count": samples,
        "sample_period_seconds": sample_period_seconds,
        "seed": seed,
        "model_id": MODEL_ID,
        "evidence_boundary": {
            "foil_phase_deg": "SOURCE_BACKED_PROJECT_INPUT",
            "head_only_yaw_architecture": "SOURCE_BACKED_PROJECT_INPUT",
            "numeric_yaw_response": "MODEL_ASSUMPTION",
            "power_proxy_kw": "SYNTHETIC_PROXY_NOT_VALIDATED_POWER_CURVE",
            "vibration_proxy": "SYNTHETIC_PROXY",
            "measured_data": False,
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return SyntheticWindRun(
        run_id=run_id,
        parquet_path=parquet_path,
        manifest_path=manifest_path,
        sample_count=samples,
    )
