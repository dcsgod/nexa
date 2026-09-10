"""Model-level explainability (spec §16.2).

Produces a *model explanation* — which signals/features drove a Graph-ML edge
prediction — NOT a fabricated natural-language chain of thought. In P1 this is
feature attribution over the heuristic/GraphSAGE inputs; when a trained GNN is
present it is swapped for a GNNExplainer-style attribution behind the same
`attribute()` signature.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SignalContribution:
    signal: str
    contribution: float  # 0..1, normalized share of the prediction


def attribute(features: dict[str, float]) -> list[SignalContribution]:
    """Normalize contributing signals into ranked shares.

    `features` maps a signal name to its raw [0,1] value. Returns descending
    contributions summing to ~1, so the UI can show "strongest contributing
    signals" without inventing reasoning.
    """
    positive = {k: max(0.0, v) for k, v in features.items()}
    total = sum(positive.values()) or 1.0
    contribs = [
        SignalContribution(signal=k, contribution=round(v / total, 4))
        for k, v in positive.items()
    ]
    contribs.sort(key=lambda c: c.contribution, reverse=True)
    return contribs
