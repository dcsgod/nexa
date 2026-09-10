# Nexa Architecture — Implementation Map

Maps the specification (`project.md`) to the code. Kept current as phases land.

## Planes → code

- **Experience Plane** (`apps/web`) — React shell, TanStack Query, React Flow
  graph. Pages: Overview, Technical Ontology (+ EdgeInspector explainability),
  Semantic Explorer, Genie Builder, Governance.
- **Application Plane** (`services/api`) — Fastify orchestrator, versioned
  Databricks adapter, ontology store, discovery pipeline, edge scoring.
- **AI Engine** (`ai/nexa_ai`) — embeddings + similarity (P0 deterministic),
  graph ML contract (GraphSAGE in P1), FastAPI service.
- **Data Truth Plane** (`ontology/schemas`, `jobs/`) — Delta DDL + Databricks
  jobs for scan/lineage/profiling/build/drift.

## Key seams

- **Databricks adapter** — `services/api/src/adapters/databricks`. `types.ts` is
  the stable contract; `mock/` is default, `live/` is the workspace impl.
  `index.ts` is the only place that chooses between them.
- **Ontology store** — `services/api/src/store/ontologyStore.ts`. In-memory in
  mock mode; a Delta-backed impl replaces it behind the same shape.
- **Confidence** — `edgeScoringService.evaluate()` is the governed trust
  function: weighted signals + gating rules + conflict detection (spec §14.1).
  It is pure and unit-tested, independent of data source.

## Discovery pipeline (P0, spec §8)

`discoveryPipeline.runDiscovery()`:
1. `scanCatalog` — UC → technical nodes (catalog/schema/table/column) +
   structural edges (contains, FK). Idempotent via fingerprint.
2. `ingestLineage` — lineage → high-trust `lineage_to` edges + evidence.
3. `profileAndScoreQuality` — column profiles → per-table quality signal.
4. `scoreCandidateEdges` — candidate joins scored with multi-factor confidence;
   trusted / candidate / conflict decided by gates.

## Explainability (spec §16)

Three separately-inspectable levels, surfaced in `EdgeInspector`:
- L1 technical evidence (`ontology_evidence`)
- L2 model attribution (graph ML — P1)
- L3 LLM semantic interpretation (grounded — P2)
