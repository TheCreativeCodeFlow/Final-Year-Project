# Stage 6 — Limitations & Threats to Validity

## 1. Internal Validity & Simulator Constraints

1. **Synthetic Attacker Sequences (No Real Human Adversaries):**
   - All 26 scenarios follow deterministic script trajectories. Real human adversaries pivot creatively, inspect timings, test edge-case HTTP encodings, and abort immediately upon subtle semantic tells. Simulated engagement duration (`ms`) reflects fixed script offsets up to coherent responses, **not real attacker dwell time**.
2. **Laboratory Watermark Headers & Response Notices:**
   - The current runtime daemon (`synthetic-service/server.js`) emits laboratory safety traceability headers (`X-Synthetic-Deception: true`, `X-Deception-Graph-Version`) and auth notices (`"Synthetic identity session..."`). Notice `gateway/src/proxy/header-sanitizer.js` strips upstream fingerprinting headers (`Server`, `X-Powered-By`) but does **not** strip `X-Synthetic-Deception`. These headers were held constant across all three evaluation systems; an actual adversary would recognize the environment immediately unless a production stealth header filter is added in future work.
3. **Rule Engine Primary Window Selection (`5m` Override of `30s`):**
   - `RuleEngineService` selects `5m` as primary window whenever `5m` features exist (`rule-engine.service.js:57`). Consequently, `RULE_AUTH_FAILURE`'s `30s` threshold (`minFailures30s = 3`) is never evaluated when `5m` exists, causing 4-failure fast bursts (`TEST-CRED-01`, `VAL-CRED-01`) to miss rule firing (`FNR = 0.2222`).

---

## 2. Construct Validity

1. **Meaningful Interaction Definition:**
   - Defining a meaningful interaction as HTTP `200` + valid domain schema + zero consistency violations/oracle contradictions avoids counting naive 404s or broken service responses as deception. However, it still measures *technical environmental coherence* rather than cognitive persuasion of a human operator.
2. **Isolation Forest Calibration on Narrow Benign Corpus:**
   - Because benign `DEVELOPMENT` training scenarios share relatively slow pacing (`2.4–4.2 s`), rapid valid API bursts (`TEST-BENIGN-03` at `450 ms`) trigger high anomaly scores (`>= 0.68`). The system remained `FP = 0` strictly because `PolicyEvaluationEngine` enforces deterministic rule corroboration before diverting traffic.

---

## 3. External Validity (Generalizability)

1. **Application Domain Specificity:** Synthetic decoys model a REST fintech API (`INITIAL_SYNTHETIC_STATE`). Results do not generalize directly to GraphQL, gRPC, SSH, or stateful binary protocols.
2. **Small Independent Sample Size ($N = 14$ Scenarios):**
   - With $N = 9$ held-out attacks ($m = 3\text{–}5$ differing pairs vs Generic Adaptive), non-parametric Wilcoxon tests lack statistical power to reach $\alpha = 0.05$ for `DSG vs Generic` comparisons (`p = 0.0625`–`0.2500`). Only `DSG vs Static` comparisons ($m = 7$, $p = 0.015625$) reach significance on the synthetic suite.
3. **Loopback vs Native Network & Docker Runtime Separation:**
   - Multi-seed trials executed over isolated TCP loopback HTTP (`~0.9 ms`), whereas real Docker containers add `~472 ms` startup and `~33.1 ms` `docker exec` IPC latency, and full Postgres persistence adds `~5–7 ms`.

---

## 4. Production Readiness & Safety Disclaimer

**Finding A remains an unresolved blocker.** This prototype is verified strictly within controlled synthetic laboratory harnesses; it **must not** be deployed for live production traffic diversion until host-level kernel netfilter quarantine and asymmetric/external trust anchors are implemented and bare-metal validated.
