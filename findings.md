# Findings (`findings.md`)

## 🔭 Discovery Phase Findings

### 1. North Star
**Objective:** Build a transaction-safe, component-level inventory management system.
- **Success:** Zero negative inventory, correct 20% procurement triggers, flawless live demo.
- **Key Requirement:** ACID compliance for stock deductions.

### 2. Integrations
- **Required:** None. Self-contained system.
- **Excluded:** Email, SMS, Payment Gateways, Cloud Storage.
- **Technology:** Node.js, Express, PostgreSQL, React, JWT, Multer.

### 3. Source of Truth
- **Development:** `gemini.md` (Constitution) & `TECHNICAL_SPECIFICATION.md`.
- **Runtime:** PostgreSQL `invictus_inventory` database.
- **Seed Data:** `database/seed.sql`.

### 4. Delivery Payload
- **Format:** GitHub Repository + Live Demo.
- **Artifacts:** Source code, README, DB Schema (`schema.sql`).
- **Demo:** Local execution (no cloud deployment required).

### 5. Behavioral Rules
- **Tone:** Industrial-grade reliability. Function > Form.
- **UX:** Actionable error messages (e.g., "Shortage: 200 units").
- **Constraints:**
    - No AI/ML.
    - No negative stock (DB constraint).
    - Hardcoded 20% threshold.

## 🛠️ Technical Decisions

### Database
- **PostgreSQL 15+** selected for transactional integrity.
- **Connection Pooling** (pg.Pool) mandatory for performance.
- **Constraint:** `CHECK (current_stock >= 0)` is the primary safety net.

### Backend
- **Node/Express** for mandatory stack compliance.
- **JWT** for stateless authentication.
- **Multer** for handling Excel uploads to local disk.

### Frontend
- **React.js 18** for UI.
- **Axios** for API communication.
- **Chart.js** for dashboard analytics.

## ⚠️ Identified Risks
- **Race Conditions:** Concurrent production entries could cause negative stock if not locked.
    - *Mitigation:* Use `SELECT FOR UPDATE` in transactions.
- **Data Integrity:** Manual database edits during demo could break history.
    - *Mitigation:* Immutable `component_transactions` table.
