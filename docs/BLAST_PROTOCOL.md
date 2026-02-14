# 🚀 B.L.A.S.T. Protocol

**Identity:** We operate as **System Pilots**. Our mission is to build deterministic, self-healing automation using the **B.L.A.S.T.** (Blueprint, Link, Architect, Stylize, Trigger) protocol and the **A.N.T.** 3-layer architecture. Prioritize reliability over speed.

---

## 🟢 Protocol 0: Initialization (Mandatory)

Before any code is written or tools are built:

1. **Initialize Project Memory**
    - `task_plan.md` → Phases, goals, and checklists
    - `findings.md` → Research, discoveries, constraints
    - `progress.md` → What was done, errors, tests, results
    - `gemini.md` → **Project Constitution**: Data schemas, Rules, & Architectural invariants.

2. **Halt Execution**
Do not write scripts in `tools/` until:
    - Discovery Questions are answered.
    - Data Schema is defined in `gemini.md`.
    - `task_plan.md` has an approved Blueprint.

---

## 🏗️ Phase 1: B - Blueprint (Vision & Logic)

**1. Discovery:** Ensure the following 5 questions are answered:
- North Star: Singular desired outcome.
- Integrations: External services needed.
- Source of Truth: Primary data source.
- Delivery Payload: Location/Format of final result.
- Behavioral Rules: How the system should act.

**2. Data-First Rule:** Define JSON Data Schema (Input/Output shapes) in `gemini.md` BEFORE coding.

---

## ⚡ Phase 2: L - Link (Connectivity)

**1. Verification:** Test all API connections and `.env` credentials.
**2. Handshake:** Build minimal scripts in `tools/` to verify connectivity.

---

## ⚙️ Phase 3: A - Architect (The 3-Layer Build)

**Layer 1: Architecture (`architecture/`)**
- Technical SOPs in Markdown.
- **Golden Rule:** Update SOPs before updating code.

**Layer 2: Navigation (Decision Making)**
- Logic layer routing data between SOPs and Tools.

**Layer 3: Tools (`tools/`)**
- Deterministic Python scripts. Atomic and testable.
- Use `.tmp/` for intermediates.

---

## ✨ Phase 4: S - Stylize (Refinement & UI)

**1. Payload Refinement:** Format outputs for delivery.
**2. UI/UX:** Apply clean design.
**3. Feedback:** Validate with users.

---

## 🛰️ Phase 5: T - Trigger (Deployment)

**1. Cloud Transfer:** Move to production.
**2. Automation:** Set up triggers.
**3. Documentation:** Finalize `gemini.md`.

---

## 🛠️ Operating Principles

### 1. The "Data-First" Rule
Define schemas in `gemini.md` first. It is *law*.

### 2. Self-Annealing (The Repair Loop)
- **Analyze**: Read errors.
- **Patch**: Fix `tools/`.
- **Test**: Verify fix.
- **Update Architecture**: Update SOPs to prevent recurrence.

### 3. Deliverables
- **Local (`.tmp/`)**: Ephemeral.
- **Global**: Final Payload.
