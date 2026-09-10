"""Nexa Python AI engine.

Owns model-heavy and data-heavy logic (spec §5.3): profiling, embeddings,
graph ML (GraphSAGE/GAT), edge scoring, semantic matching, entity resolution,
explainability, evaluation and the MLflow lifecycle.

In P0 this package provides the service scaffold and deterministic fallbacks so
the platform runs with no ML dependencies installed. Heavy models arrive in P1
behind the same interfaces (see optional [ml] extra in pyproject.toml).
"""

__version__ = "0.1.0"
