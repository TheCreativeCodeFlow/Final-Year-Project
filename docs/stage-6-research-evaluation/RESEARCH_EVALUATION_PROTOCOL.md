# Stage 6 — Research Evaluation Protocol

## 1. Research Objective & Scope

Stage 6 validates whether attacker-specific **Deception State Graph (DSG)** adaptation provides measurable deception consistency and interaction quality benefits compared with (A) a **Static Honeypot Baseline** and (B) a **Generic Adaptive Deception Baseline**, while quantifying incurred runtime overhead.

No production traffic is diverted during evaluation. The unresolved host `INPUT` firewall finding (**Finding A**, Stage 5B.2.1/5B.2.2) remains a hard activation blocker for live gateway diversion (`CONTROLLED_LAB_BLOCKED`), so comparative experiments execute inside an **isolated synthetic evaluation harness** supplemented by a dedicated **live isolated Docker container parity run** on `Internal: true` bridge networks.

---

## 2. Pre-Evaluation Repository Integrity Audit Findings

Before executing Stage 6 experiments, existing research scripts and integration points were audited against runnable code:

1. **Prior Script Audit (`backend/scripts/dsg-research-evaluation.js`, Stage 5B.4):**
   - `runGenericAdaptiveEvaluation()` simulated conflicts synthetically using modulo arithmetic (`i % 7 === 0`), randomized latency (`8 + Math.random() * 12`), and hardcoded rejection rates (`32.5%`).
   - Stage 6 **never relies on those numbers** and replaces that paradigm with an executed, stateless HTTP baseline.
2. **Prior Benchmark Audit (`backend/scripts/gateway-routing-benchmark.js`, Stage 5B.5.1):**
   - Pipeline step timings used synthetic deterministic formulas (`2.3 + (i % 5) * 0.12`), computed confusion counts from `workload.groundTruth` instead of detector output, and repeated 10 scenarios 30x as `240` scenarios.
   - Stage 6 eliminates synthetic formulas: every latency is measured with monotonic `process.hrtime.bigint()`, every verdict comes from the real detection/policy code, and **scenario** ($N=14$ held-out) is the strict statistical unit of analysis.
3. **Stage 4C -> Stage 5A Schema Integration Bugs Caught & Fixed:**
   - `HybridAssessmentService.evaluateAssessment()` wrote `ruleResult?.allFindings || []` while `RuleEngineService` returned `triggeredFindings` (yielding empty rule arrays), omitted top-level `dataQualityState`/`telemetryLossDetected`, and emitted `'NORMAL'` while `PolicyEvaluationEngine` Guard 4 checked only `'BENIGN'`.
   - Both components were minimally aligned while preserving backward compatibility (`39/39` detection & policy tests pass).
4. **Evidence Hash Chain Tie-Breaking Fix:**
   - `dsg-execution-engine.test.js` Test 22 exposed a sub-millisecond DB timestamp tie between concurrent `MUTATION_INSPECTED` and `MUTATION_VERIFIED` writes (`recordedAt = 2026-11-10 13:13:27.388`) causing sequence #49 duplication in `ExecutionEvidenceRecorder`.
   - Fixed via per-scope async serialization, top-10 `sequenceNumber` resolution, and strictly monotonic `recordedAt` timestamps (`dsg-execution-engine.test.js` subsequently passed `25/25`).
5. **Test Suite Isolation Finding:**
   - Several existing integration tests (`behavioral-features-api.test.js`, `security-operations.test.js`, `database-integrity.test.js`, `tenant-api.test.js`) call `prisma.protectedApplication.deleteMany({})` against the shared test DB without restoring seeded applications afterward, causing downstream Stage 5A.1 (`deception-policy-semantics-dsg.test.js`) lookups to fail unless re-seeded, while Stage 5A.1 Test 21 fails if later Stage 5B.5 `PolicyDecision` rows (`evaluatorVersion = '5B.5'`) remain in DB. Recorded transparently in `STAGE_COMPLETION_REPORT.md`.

---

## 3. Experimental Protocol Steps

1. **Zero-Leakage Verification:** `auditScenarioPartitionLeakage()` verifies zero ID, client IP, unseen username, or scenario route overlap across `DEVELOPMENT` (6), `VALIDATION` (6), and held-out `TEST` (14).
2. **JIT & Socket Warm-up:** Executes 3 validation scenarios across all 3 systems (`66.35 ms`), discarded completely from reported metrics.
3. **Validation Parity Check:** Runs all 6 `VALIDATION` scenarios across all 3 systems (`Precision = 1.0`, `Recall = 0.25`, reflecting unmodified conservative rule gates before held-out execution).
4. **Counterbalanced Multi-Seed Held-Out Run:** Evaluates all 14 held-out `TEST` scenarios across 5 deterministic seeds (`[101, 202, 303, 404, 505]`), calibrating `FeaturePreprocessor` + `IsolationForest(seed)` strictly on `DEVELOPMENT` benign vectors for each seed and rotating paradigm execution order (`[S, G, D]`, `[G, D, S]`, `[D, S, G]`) to prevent JIT/GC ordering bias.
5. **Live Docker Parity Experiment:** Provisions real `deception-synthetic-service:1.0.0` containers inside airgapped `Internal: true` bridge networks via `ContainerRuntimeAdapter` to quantify container startup, `docker exec` IPC mutation overhead, rollback time, and cgroup RAM/CPU footprints.
