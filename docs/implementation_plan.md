# Implementation Plan - Component-Level Inventory Management System

## Goal Description
Build a transaction-safe, component-level inventory management system for Electrolyte Solutions using the B.L.A.S.T. protocol. The system will track PCB production, deduct component stock atomically, and trigger procurement alerts.

## User Review Required
> [!IMPORTANT]
> **Strict Conformance**: This implementation follows the "Industrial Grade" behavioral rules defined in `gemini.md`. reliability > aesthetics.
> **Database**: PostgreSQL 15+ is required. Ensure it is installed and running.

## Proposed Changes

### Phase 2: Link (Connectivity) & Setup
#### [NEW] [Backend Initialization]
- Initialize `backend/` directory with `package.json`.
- Install dependencies: `express`, `pg`, `cors`, `dotenv`, `jsonwebtoken`, `bcrypt`, `multer`, `xlsx`, `exceljs`, `express-validator`.
- Create `backend/.env` with database and JWT credentials.
- Create `backend/server.js` (entry point).
- Verify database connection with a script.

#### [NEW] [Database Setup]
- Create `database/schema.sql` with **ALL 7 REQUIRED TABLES**:
  1. **users** (authentication)
  2. **components** (with `CHECK (current_stock >= 0)` constraint)
  3. **pcb_types** (product templates)
  4. **pcb_components_mapping** (Bill of Materials)
  5. **production_entries** (transaction triggers)
  6. **component_transactions** (CRITICAL - immutable audit trail)
  7. **procurement_triggers** (20% threshold alerts)

- Add **DATABASE INDEXES** for performance:
  ```sql
  CREATE INDEX idx_components_part_number ON components(part_number);
  CREATE INDEX idx_production_date ON production_entries(production_date);
  CREATE INDEX idx_transactions_component ON component_transactions(component_id);
  CREATE INDEX idx_procurement_status ON procurement_triggers(status);
  CREATE INDEX idx_transactions_created ON component_transactions(created_at DESC);
  ```

- Create `database/seed.sql` with sample data.
- Run setup scripts to initialize `invictus_inventory` DB.

#### [NEW] [Frontend Initialization]
- Initialize `frontend/` using Vite (React) OR Create React App.
- Install dependencies: `axios`, `react-router-dom`, `chart.js`, `react-chartjs-2`, `jwt-decode`.
- Configure `frontend/src/services/api.js` for Backend connectivity.

### Phase 3: Architect (The Build)
#### [NEW] [Backend Architecture]
- **Config**: `database.js` (pg pool with connection management).
- **Middleware**: 
  - `auth.js` (JWT verification)
  - `errorHandler.js` (centralized error handling)
  - `upload.js` (Multer configuration for Excel uploads)

- **Controllers & Routes**:
  - `authController.js` / `authRoutes.js`: Login/Register with bcrypt hashing.
  
  - `componentController.js` / `componentRoutes.js`: 
    - **Core Inventory Management** (from skillset + upgrades):
      - CRUD operations (Add, Edit, View, Delete)
      - **Bulk Import/Export**: 
        - POST `/api/components/import` (CSV/Excel parsing from skillset)
        - GET `/api/components/export` (Current stock snapshot)
      - **Smart Lookup**:
        - Fuzzy matching for part numbers (skillset feature)
        - Automatic key generation for unknown parts
      - **Industrial Upgrades**:
        - Transaction logging for every stock change (audit trail)
        - Atomic stock checks prevents negative inventory actions
  
  - **`pcbController.js` / `pcbRoutes.js`** (MISSING - CRITICAL):
    - GET `/api/pcb-types` (list all PCB types)
    - POST `/api/pcb-types` (create PCB with BOM mapping)
    - GET `/api/pcb-types/:id` (get PCB details with components)
    - GET `/api/pcb-types/:id/bom` (get BOM for production preview)
  
  - `productionController.js` / `productionRoutes.js`: 
    - **POST `/api/production/entry`** - Core atomic deduction logic with:
      ```javascript
      // ROW-LEVEL LOCKING (prevents race conditions)
      const lockQuery = `
        SELECT component_id, current_stock 
        FROM components 
        WHERE component_id = ANY($1) 
        FOR UPDATE
      `;
      
      // PROCUREMENT TRIGGER LOGIC (20% threshold)
      const threshold = component.monthly_required_quantity * 0.20;
      if (newBalance < threshold && previousBalance >= threshold) {
        // Create procurement trigger ONLY when crossing threshold
        await client.query(`
          INSERT INTO procurement_triggers 
          (component_id, current_stock, required_stock, shortage_quantity, triggered_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [componentId, newBalance, threshold, threshold - newBalance]);
      }
      ```
    - GET `/api/production/history` (production audit trail)
  
  - `dashboardController.js` / `dashboardRoutes.js`: 
    - Analytics queries (total components, low stock, production stats)
  
  - `procurementController.js` / `procurementRoutes.js`: 
    - Trigger management (list, acknowledge, filter by status)
  
  - **`reportController.js` / `reportRoutes.js`** (NEW - for exports):
    - GET `/api/reports/inventory-export` - Current inventory snapshot
    - GET `/api/reports/consumption-export?start_date=X&end_date=Y` - Production history with component usage
    - GET `/api/reports/transaction-history/:componentId` - Component-specific audit trail

#### [NEW] [Frontend Architecture]
- **Context**: `AuthContext.js` for authentication state management.
- **Error Boundaries**: 
  - Create `ErrorBoundary.jsx` component
  - Wrap main App component to catch "White Screen of Death"
  - Display user-friendly error message instead of blank screen

- **Components**:
  - `layout/`: Sidebar, Navbar, Layout wrapper.
  - `dashboard/`: Charts, Stats Cards, Real-time metrics.
  - `components/`: Component Table, Add/Edit Forms, Import/Export UI.
  
  - **`pcb/`** (BOM Builder with CAD Import):
    - `PCBList.jsx` (table of all PCB types)
    - `PCBForm.jsx` (create/edit PCB)
    - `BOMBuilder.jsx` (manual BOM mapping):
      * Component selector dropdown
      * Quantity input per component
      * Dynamic component adding/removal
      * Save BOM mapping to `pcb_components_mapping` table
    - **`CADImporter.jsx`** (OPTIONAL - productivity feature):
      * Upload CAD files (KiCad, Eagle, Altium, EasyEDA, PDF)
      * Trigger `.agent/skills/pcb_parser/` skill
      * Auto-populate BOM from parsed components
      * **Workflow**: See `.agent/skills/workflows/pcb-cad-import-integration.md`
      * **Implementation**: Checkpoint 3.4.2 (after manual BOM builder works)
  
  - `production/`: Production Entry Form (with dynamic BOM preview and confirmation).
  - `procurement/`: Trigger List (pending/acknowledged filters).
  - `reports/`: Export interfaces and transaction history viewer.

### Phase 4: Stylize (Refinement)
- [COMPLETED] **Loader Component**:
  - Integrate custom `Loader` component (SVG animation).
  - Implement `PageLoader` wrapper with 2-3s artificial delay.
  - Apply before Login and Dashboard entry.
- [COMPLETED] **Animated Sidebar**:
  - Integrate Aceternity UI sidebar with `framer-motion`.
  - Replace static sidebar with collapsible, animated navigation.
- Apply "Industrial" styling (clean, high contrast, dense data).
- Implement actionable error messages (e.g., "Insufficient stock: Capacitor C101 needs 500, only 300 available").
- Dashboards with `react-chartjs-2`.
- Form validation with inline error displays.

## Verification Plan

### Automated Verification
- **Backend Tests**:
  - Script to simulate concurrent production entries (tests atomicity with SELECT FOR UPDATE).
  - Script to attempt creating negative stock (must fail with CHECK constraint).
  - Script to check procurement triggers after stock depletion (verify 20% threshold).
  - **Script to verify component_transactions table**:
    * Every stock change creates a transaction record
    * `balance_after` matches `component.current_stock`
    * Transaction log is immutable (no UPDATE/DELETE allowed)

- **Frontend Tests**:
  - Verify "White Screen of Death" protection (Error Boundaries catch crashes).
  - Test form validation on all input fields.

### Manual Verification
- **Demo Flow**:
  1. Login as Admin.
  2. Import Components via Excel.
  3. View Dashboard (Green status).
  4. Create PCB Type with manual BOM mapping (3-5 components).
  5. Create Production Entry for "PCB-A" (High Volume).
  6. Verify Stock Deduction in Inventory.
  7. Verify Procurement Trigger created for low stock items.
  8. Attempt Production > Remaining Stock (Expect Error with actionable message).
  9. **Export current inventory to Excel** (verify file download).
  10. **Export consumption report for date range** (verify production history).
  11. **View component transaction history** (audit trail with balance_after).
  12. **Test concurrent production entries** (open two browser tabs, submit simultaneously, verify atomicity).

## Implementation Notes

### Critical Requirements
1. **SELECT FOR UPDATE** in productionController.js to prevent race conditions.
2. **component_transactions** table as immutable audit trail (no UPDATE/DELETE operations).
3. **CHECK constraint** on components.current_stock >= 0 (database-level safety).
4. **Procurement trigger** threshold at exactly 20% (hardcoded, not configurable).
5. **Row-level locking** during stock deduction transactions.

### Optional Features (Available via Antigravity Skills)
- **CAD file import** (KiCad, Eagle, Altium, EasyEDA, PDF parsing):
  - Already implemented in `.agent/skills/pcb_parser/`
  - Can be integrated if time permits (see workflow: `.agent/skills/workflows/pcb-cad-import-integration.md`)
  - Recommended as Checkpoint 3.4.2 (after manual BOM builder)

### Explicitly Removed from MVP
- AI/ML-based demand forecasting.
- Multi-location warehouse support.
- Barcode/QR code scanning.
- Email notifications for procurement triggers.

### Technology Stack (Mandatory)
- **Backend**: Node.js 18+ with Express.js
- **Database**: PostgreSQL 15+ with pg client
- **Frontend**: React 18 with Vite
- **Authentication**: JWT (jsonwebtoken + bcrypt)
- **File Processing**: Multer + xlsx/exceljs
- **Charts**: Chart.js + react-chartjs-2
