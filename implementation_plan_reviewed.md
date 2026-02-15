# Implementation Plan - Component-Level Inventory Management System

## Goal Description
Build a transaction-safe, component-level inventory management system for Electrolyte Solutions using the B.L.A.S.T. protocol. The system will track PCB production, deduct component stock atomically, and trigger procurement alerts.

## User Review Required

> [!IMPORTANT]
> **Strict Conformance**: This implementation follows the "Industrial Grade" behavioral rules defined in `gemini.md`. reliability > aesthetics. Database: PostgreSQL 15+ is required. Ensure it is installed and running.

## Proposed Changes

### Phase 2: Link (Connectivity) & Setup

#### [NEW] [Backend Initialization]
- Initialize `backend/` directory with `package.json`.
- Install dependencies: express, pg, cors, dotenv, jsonwebtoken, bcrypt, multer, xlsx, express-validator.
- Create `backend/.env` with database and JWT credentials.
- Create `backend/server.js` (entry point).
- Verify database connection with a script.

#### [NEW] [Database Setup]
- Create `database/schema.sql` based on `gemini.md`.

<!-- COMMENT: Missing explicit table list. ADD: List all 7 required tables:
  1. users
  2. components (with CHECK constraint: current_stock >= 0)
  3. pcb_types
  4. pcb_components_mapping (BOM)
  5. production_entries
  6. component_transactions (MISSING - this is critical for audit trail)
  7. procurement_triggers
-->

<!-- COMMENT: Missing indexes. ADD: Database indexes for performance:
  - CREATE INDEX idx_components_part_number ON components(part_number);
  - CREATE INDEX idx_production_date ON production_entries(production_date);
  - CREATE INDEX idx_transactions_component ON component_transactions(component_id);
  - CREATE INDEX idx_procurement_status ON procurement_triggers(status);
-->

- Create `database/seed.sql` with sample data.
- Run setup scripts to initialize `invictus_inventory` DB.

#### [NEW] [Frontend Initialization]
- Initialize `frontend/` using Vite (React).
- Install dependencies: axios, react-router-dom, chart.js, react-chartjs-2, jwt-decode.
- Configure `frontend/src/services/api.js` for Backend connectivity.

---

### Phase 3: Architect (The Build)

#### [NEW] [Backend Architecture]
- **Config**: `database.js` (pg pool).
- **Middleware**: `auth.js` (JWT), `errorHandler.js`.
- **Controllers & Routes**:
  - `authController.js` / `authRoutes.js`: Login/Register.
  - `componentController.js` / `componentRoutes.js`: CRUD + Import/Export.

<!-- COMMENT: Missing Excel export specification. ADD: Two export endpoints:
  1. GET /api/components/export - Current inventory snapshot
  2. GET /api/reports/consumption-export?start_date=X&end_date=Y - Production history with component usage
-->

  - `productionController.js` / `productionRoutes.js`: Core Logic (Atomic Deduction).

<!-- COMMENT: Missing row-level locking. ADD: In productionController.js, use SELECT FOR UPDATE:
  const lockQuery = `
    SELECT current_stock 
    FROM components 
    WHERE component_id = ANY($1) 
    FOR UPDATE
  `;
  This prevents race conditions during concurrent production entries.
-->

<!-- COMMENT: Missing procurement trigger threshold logic. ADD: Explicitly document 20% calculation:
  const threshold = component.monthly_required_quantity * 0.20;
  if (newBalance < threshold && previousBalance >= threshold) {
    // Create procurement trigger only when crossing threshold
  }
-->

  - `dashboardController.js` / `dashboardRoutes.js`: Analytics.
  - `procurementController.js` / `procurementRoutes.js`: Triggers.

<!-- COMMENT: Missing PCB controller. ADD: pcbController.js / pcbRoutes.js for:
  - GET /api/pcb-types (list all PCB types)
  - POST /api/pcb-types (create PCB with BOM mapping)
  - GET /api/pcb-types/:id (get PCB details with components)
-->

#### [NEW] [Frontend Architecture]
- **Context**: `AuthContext.js` for state management.
- **Components**:
  - `layout/`: Sidebar, Navbar.
  - `dashboard/`: Charts, Stats Cards.
  - `inventory/`: Component Table, Add/Edit Forms.
  - `production/`: Production Entry Form (with dynamic BOM display).
  - `pcb/`: BOM Builder with CAD Import (KiCad, Eagle, PDF).

<!-- COMMENT: SCOPE CREEP - CAD Import is NOT in original requirements. REMOVE CAD import from MVP. 
  REPLACE WITH: pcb/: PCB Type Management
    - PCBList.jsx (table of all PCB types)
    - PCBForm.jsx (create/edit with manual BOM mapping)
      * Component selector dropdown
      * Quantity input per component
      * Save BOM mapping to pcb_components_mapping table
-->

  - `procurement/`: Trigger List.

---

### Phase 4: Stylize (Refinement)
- Apply "Industrial" styling (clean, high contrast, dense data).
- Implement actionable error messages.
- Dashboards with react-chartjs-2.

<!-- COMMENT: Missing Error Boundaries. ADD: Implement React Error Boundaries:
  - Create ErrorBoundary.jsx component
  - Wrap main App component to catch "White Screen of Death"
  - Display user-friendly error message instead of blank screen
-->

---

## Verification Plan

### Automated Verification

**Backend Tests**:
- Script to simulate concurrent production entries (tests atomicity).
- Script to attempt creating negative stock (must fail).
- Script to check procurement triggers after stock depletion.

<!-- COMMENT: Good test scenarios. ADD: Also test component_transactions table:
  - Verify every stock change creates a transaction record
  - Verify transaction balance_after matches component.current_stock
-->

**Frontend Tests**:
- Verify "White Screen of Death" protection (Error Boundaries).

### Manual Verification

**Demo Flow**:
1. Login as Admin.
2. Import Components via Excel.
3. View Dashboard (Green status).
4. Create Production Entry for "PCB-A" (High Volume).
5. Verify Stock Deduction in Inventory.
6. Verify Procurement Trigger created for low stock items.
7. Attempt Production > Remaining Stock (Expect Error).

<!-- COMMENT: Good demo flow. ADD: Also demonstrate:
  8. Export current inventory to Excel
  9. Export consumption report for date range
  10. View component transaction history (audit trail)
  11. Test concurrent production entries (open two browser tabs, submit simultaneously)
-->
