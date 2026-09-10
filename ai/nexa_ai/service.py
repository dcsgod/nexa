"""FastAPI surface for the Nexa AI engine.

The Node orchestrator calls this service for model-heavy work. In P0 the only
live capability is embeddings + semantic similarity (deterministic). Graph ML
(GraphSAGE), semantic matching and explainability endpoints are declared here
with clear P1 contracts so the Node side can integrate against stable shapes.
"""
from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from .embeddings import MODEL_ID, cosine, embed
from .explainability import attribute
from .graph import MODEL_VERSION as GRAPH_MODEL_VERSION, predict_edge
from .tracking import log_prediction_batch, mlflow_available

app = FastAPI(title="Nexa AI Engine", version="0.1.0")


class HealthOut(BaseModel):
    status: str
    embedding_model: str
    graph_model: str
    ml_available: bool
    mlflow_available: bool


@app.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(
        status="ok",
        embedding_model=MODEL_ID,
        graph_model=GRAPH_MODEL_VERSION,
        ml_available=_ml_available(),
        mlflow_available=mlflow_available(),
    )


class EmbedIn(BaseModel):
    texts: list[str]


class EmbedOut(BaseModel):
    model_id: str
    vectors: list[list[float]]


@app.post("/embed", response_model=EmbedOut)
def embed_texts(body: EmbedIn) -> EmbedOut:
    results = [embed(t) for t in body.texts]
    return EmbedOut(model_id=MODEL_ID, vectors=[r.vector for r in results])


class SimilarityIn(BaseModel):
    query: str
    candidates: list[str]
    top_k: int = 5


class SimilarityHit(BaseModel):
    candidate: str
    score: float


class SimilarityOut(BaseModel):
    model_id: str
    hits: list[SimilarityHit]


@app.post("/similarity", response_model=SimilarityOut)
def similarity(body: SimilarityIn) -> SimilarityOut:
    q = embed(body.query).vector
    scored = [
        SimilarityHit(candidate=c, score=round(cosine(q, embed(c).vector), 4))
        for c in body.candidates
    ]
    scored.sort(key=lambda h: h.score, reverse=True)
    return SimilarityOut(model_id=MODEL_ID, hits=scored[: body.top_k])


class EdgeCandidate(BaseModel):
    edge_id: str
    source_text: str
    target_text: str
    source_features: dict = {}
    target_features: dict = {}
    lineage: float = 0.0
    behavioral: float = 0.0


class EdgeScore(BaseModel):
    edge_id: str
    model_version: str
    prediction: float
    embedding_similarity: float
    attribution: list[dict]


class PredictEdgesOut(BaseModel):
    model_version: str
    mlflow: dict
    scores: list[EdgeScore]


@app.post("/predict-edges", response_model=PredictEdgesOut)
def predict_edges(candidates: list[EdgeCandidate]) -> PredictEdgesOut:
    """Graph-ML edge predictions + model-level attribution (spec §13, §16.2).

    Combines embedding similarity of the two endpoints with the GraphSAGE
    (heuristic in P0/P1) link prediction, and returns a ranked feature
    attribution for each so the UI can render a Level-2 model explanation.
    """
    scores: list[EdgeScore] = []
    for c in candidates:
        emb_sim = round(cosine(embed(c.source_text).vector, embed(c.target_text).vector), 4)
        pred = predict_edge(c.source_features, c.target_features)
        # blend embedding similarity with structural link prediction
        blended = round(0.5 * emb_sim + 0.5 * pred.prediction, 4)
        contribs = attribute(
            {
                "embedding_similarity": emb_sim,
                "graph_link_prediction": pred.prediction,
                "lineage": c.lineage,
                "behavioral_usage": c.behavioral,
            }
        )
        scores.append(
            EdgeScore(
                edge_id=c.edge_id,
                model_version=pred.model,
                prediction=blended,
                embedding_similarity=emb_sim,
                attribution=[{"signal": s.signal, "contribution": s.contribution} for s in contribs],
            )
        )

    mlflow_result = log_prediction_batch(
        model_version=GRAPH_MODEL_VERSION,
        params={"n_candidates": len(candidates)},
        metrics={
            "mean_prediction": round(
                sum(s.prediction for s in scores) / len(scores), 4
            )
            if scores
            else 0.0
        },
    )
    return PredictEdgesOut(model_version=GRAPH_MODEL_VERSION, mlflow=mlflow_result, scores=scores)


def _ml_available() -> bool:
    try:
        import torch  # noqa: F401
        import torch_geometric  # noqa: F401

        return True
    except Exception:
        return False
