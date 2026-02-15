---
description: How to implement and run the Missing Components Detection System
---

# Missing Components Detection System — Workflow

## Overview
This workflow describes the Missing Components Intelligence Layer that detects, classifies, and reports components from a parsed schematic BOM that are not fully matched in the inventory database.

---

## Phase 1: Backend — Reconciliation Engine

### 1.1 Create `missingComponentsController.js`
- Path: `backend/controllers/missingComponentsController.js`
- Implement `reconcileBOM` endpoint that:
  1. Accepts `{ bomComponents[], buildQty }` from frontend
  2. For each BOM item, runs matching hierarchy:
     - Exact MPN match → `components.part_number`
     - Value + Package + Type heuristic match
     - Description fuzzy match (Levenshtein distance)
  3. Classifies each component as: `available`, `shortage`, or `missing`
  4. Returns reconciliation result with full details

### 1.2 Create `exportMissingReport` endpoint
- Generates `Missing_Components_Report.xlsx` with standardized columns
- Separate worksheet with conditional formatting
- Includes summary statistics

### 1.3 Create `addMissingToInventory` endpoint
- Optional toggle: batch-insert missing components into DB
- Stock initialized to 0, marked as "Unprocured"
- Creates procurement alerts

---

## Phase 2: Backend — Routes & API

### 2.1 Create `missingComponentsRoutes.js`
- Path: `backend/routes/missingComponentsRoutes.js`
// turbo
- `POST /api/missing-components/reconcile` → `reconcileBOM`
- `POST /api/missing-components/export-report` → `exportMissingReport`
- `POST /api/missing-components/add-to-inventory` → `addMissingToInventory`

### 2.2 Register routes in `server.js`

---

## Phase 3: Frontend — API & State

### 3.1 Add API methods in `api.js`
- `reconcileBOM(bomComponents, buildQty)`
- `exportMissingReport(reconciliationData)`
- `addMissingToInventory(missingComponents)`

---

## Phase 4: Frontend — UI Enhancement

### 4.1 Enhance Import Preview Modal (`InventoryPage.jsx`)
- After schematic parse, show "Reconcile with Inventory" button
- Color-coded table rows: Green (available), Orange (shortage), Red (missing)
- Add Build Quantity input for scaling
- Show reconciliation analytics (% coverage, missing SKUs, build readiness)

### 4.2 Add Missing Components Panel
- Expandable section below the preview table
- Shows only missing/shortage items with full detail
- "Add Missing to Inventory" toggle
- "Export Missing Report" button
- "Export Procurement List" button

---

## Phase 5: Verification

### 5.1 Syntax verification
// turbo
```
node -c backend/controllers/missingComponentsController.js
node -c backend/routes/missingComponentsRoutes.js
node -c backend/server.js
```

### 5.2 Manual testing
1. Import a schematic file with components not in the database
2. Verify reconciliation shows correct statuses
3. Verify color coding in the UI
4. Test "Add Missing to Inventory" toggle
5. Test Excel report export
6. Verify build quantity scaling
