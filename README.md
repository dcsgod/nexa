# Nexa — Databricks Semantic Ontology & Explainable AI Platform

An enterprise **Semantic Intelligence Platform for Databricks**: it discovers the
technical structure of a Lakehouse, builds a machine-grounded **Technical
Knowledge Graph**, derives a governed **Enterprise Semantic Layer**, explains
every AI decision with evidence, detects drift, and compiles business intent
into governed **Genie Agents**.

> Discover the truth. Understand the meaning. Prove the relationship.
> Govern the interpretation. Compile the intelligence.

## Design guarantee

- **Technical truth first** — the graph is discovered from Unity Catalog and is
  never silently overwritten by AI.
- **Evidence before confidence** — every relationship and mapping carries an
  evidence bundle.
- **Fail closed** — low-confidence or conflicting semantics require human review.

## Architecture

| Plane | Tech | Location |
|-------|------|----------|
| Experience | React + TS + React Flow | `apps/web` |
| Application / Orchestration | Node + Fastify + TS | `services/api` |
| AI / Graph / Semantics | Python + FastAPI (torch/PyG optional) | `ai/` |
| Data Truth | Delta Lake / Unity Catalog | `ontology/schemas`, `jobs/` |

All Databricks access is behind a **versioned adapter** (`services/api/src/adapters/databricks`).
The **mock** implementation is the default and needs no credentials; the **live**
implementation is selected with `NEXA_MODE=live`.

## Run it (mock mode, zero credentials)

```bash
npm install                 # root: installs web + api workspaces
npm run dev                 # starts API :8080 and web :5173 together
# optional AI engine:
py -m uvicorn nexa_ai.service:app --app-dir ai --port 8100
```

Open http://localhost:5173 — the ontology is warmed from the seeded retail
Lakehouse on boot.

## Switch to a real workspace

Copy `.env.example` → `.env`, set `NEXA_MODE=live` and the `DATABRICKS_*` values,
then implement the documented method bodies in
`services/api/src/adapters/databricks/live/liveAdapter.ts`.

## Build status

All specification phases and both additive features are implemented and
verified end-to-end in mock mode (32 tests passing).

| Phase | Scope | Status |
|-------|-------|--------|
| **P0** | App shell, Node API, Python engine, UC scanner, technical graph, lineage, profiling, evidence-backed edge scoring | ✅ |
| **P1** | Embeddings, semantic retrieval, GraphSAGE predictions, MLflow, model (L2) explainability, human governance | ✅ |
| **P2** | Business concepts, dual graph/LLM mappings, metrics + grain, conflict engine, Ontology Critic, L3 grounded explanations | ✅ |
| **P3** | Semantic compiler: NL intent → asset selection → join planning → grain safeguard → Genie config | ✅ |
| **P4** | Benchmarks, quality/deploy gate (fail-closed), provisioning, embedded chat with evidence, Genie explainability | ✅ |
| **P5** | Schema drift, impact analysis, affected-Genie detection, self-healing loop | ✅ |
| **§55** | Concept Timeline — append-only mapping history, diff, conflict log | ✅ |
| **§56** | Counterfactual "Simulate Impact" before commit (Threshold Lab) | ✅ |

Remaining work is integration-only: fill in the live Databricks/LLM adapter
method bodies, back the ontology store with Delta, and wire the Databricks
Apps/Jobs bundle.

See `project.md` for the full specification and `docs/ARCHITECTURE.md` for the
implementation map.
