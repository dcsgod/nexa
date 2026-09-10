"""Graph ML layer (spec §13) — GraphSAGE link prediction.

P1 target: a 2-layer inductive GraphSAGE (PyTorch Geometric) trained on
positive edges (declared PK/FK, high-confidence lineage, human-verified) and
carefully sampled hard negatives. Inductive so new tables can be scored without
retraining the whole graph (spec §30).

This module defines the stable contract the edge-scoring pipeline depends on.
The P0 implementation is a deterministic heuristic so the interface is testable
before torch is installed; swap `predict_edge` for the trained model in P1.
"""
from __future__ import annotations

from dataclasses import dataclass

MODEL_VERSION = "ontology_graphsage_v0_heuristic"


@dataclass
class EdgePrediction:
    source: str
    target: str
    model: str
    prediction: float


def predict_edge(source_features: dict, target_features: dict) -> EdgePrediction:
    """Heuristic stand-in for GraphSAGE link prediction.

    Uses name/type overlap as a proxy score in [0,1]. Replaced in P1 by the
    trained inductive model; callers only depend on EdgePrediction.
    """
    name_a = str(source_features.get("name", ""))
    name_b = str(target_features.get("name", ""))
    type_a = str(source_features.get("data_type", ""))
    type_b = str(target_features.get("data_type", ""))

    name_score = 1.0 if _norm(name_a) == _norm(name_b) else 0.4
    type_score = 1.0 if type_a.split("(")[0] == type_b.split("(")[0] else 0.3
    pred = round(0.6 * name_score + 0.4 * type_score, 4)
    return EdgePrediction(
        source=str(source_features.get("id", name_a)),
        target=str(target_features.get("id", name_b)),
        model=MODEL_VERSION,
        prediction=pred,
    )


def _norm(name: str) -> str:
    return name.lower().removesuffix("_id").removesuffix("_key")
