"""MLflow lifecycle wrapper (spec §38).

MLflow is optional in mock mode. When installed, `log_prediction_batch` records
the model version, params and metrics as a run; when absent it degrades to a
no-op that still returns the model version so callers behave identically. Every
prediction always identifies its model version regardless.
"""
from __future__ import annotations

from typing import Any


def mlflow_available() -> bool:
    try:
        import mlflow  # noqa: F401

        return True
    except Exception:
        return False


def log_prediction_batch(
    model_version: str,
    params: dict[str, Any],
    metrics: dict[str, float],
    experiment: str = "nexa_edge_scoring",
) -> dict[str, Any]:
    """Log a scoring batch to MLflow if available; otherwise no-op."""
    if not mlflow_available():
        return {"logged": False, "model_version": model_version, "reason": "mlflow_not_installed"}

    import mlflow

    mlflow.set_experiment(experiment)
    with mlflow.start_run() as run:
        mlflow.log_param("model_version", model_version)
        for k, v in params.items():
            mlflow.log_param(k, v)
        for k, v in metrics.items():
            mlflow.log_metric(k, v)
        return {"logged": True, "model_version": model_version, "run_id": run.info.run_id}
