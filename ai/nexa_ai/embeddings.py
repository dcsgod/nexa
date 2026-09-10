"""Embedding generation for tables and columns (spec §12).

P0 ships a deterministic hashing embedder so semantic retrieval works with no
model download. In P1 this is swapped for a real sentence/embedding model or
Databricks Model Serving behind the same `embed()` signature. Embeddings must
be reproducible by version, so the model id is always returned alongside.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

EMBEDDING_DIM = 64
MODEL_ID = "nexa-hash-embed-v0"


@dataclass
class EmbeddingResult:
    text: str
    vector: list[float]
    model_id: str


def _hash_embed(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Deterministic bag-of-tokens hashing embedding, L2-normalized."""
    vec = [0.0] * dim
    for token in _tokenize(text):
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if (h >> 8) & 1 else -1.0
        vec[idx] += sign
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]


def _tokenize(text: str) -> list[str]:
    out: list[str] = []
    for part in text.lower().replace(".", " ").replace("_", " ").split():
        out.append(part)
    return out


def embed(text: str) -> EmbeddingResult:
    return EmbeddingResult(text=text, vector=_hash_embed(text), model_id=MODEL_ID)


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5 or 1.0
    nb = sum(y * y for y in b) ** 0.5 or 1.0
    return dot / (na * nb)
