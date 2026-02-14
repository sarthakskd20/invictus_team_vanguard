# 🎯 PROJECT CONSTITUTION - Invictus Hackathon
## Component-Level Inventory Management System

**Project Type:** Hackathon MVP  
**Client:** Electrolyte Solutions (Electronics Manufacturing - PCB)  
**Framework:** B.L.A.S.T. Protocol  
**Last Updated:** February 14, 2026

---

## 📋 NORTH STAR OBJECTIVE

**Singular Desired Outcome:**  
Build a transaction-safe, component-level inventory management system that automatically deducts component stock when PCBs are produced, triggers procurement alerts at 20% threshold, and provides real-time visibility through Excel integration and dashboard analytics.

**Success Metric:**  
Zero negative inventory values + Correct procurement triggers + Flawless demo

---

## 🔗 INTEGRATIONS & DEPENDENCIES

### Mandatory Technology Stack (Non-Negotiable)
- **Frontend:** React.js 18.x
- **Backend:** Node.js 18+ with Express.js
- **Database:** PostgreSQL 15+ with `pg` client
- **Authentication:** JWT (JSON Web Tokens)
- **File Handling:** Multer (uploads) + xlsx/exceljs (Excel processing)

### External Services
- None (Self-contained system)

### API Keys Required
- None (JWT generated internally)

### Environment Variables
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invictus_inventory
DB_USER=postgres
DB_PASSWORD=<user_provided>

# Security
JWT_SECRET=<generated_secret>
JWT_EXPIRE=7d

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

---

## 📊 DATA SCHEMAS (THE LAW)

### Schema 1: Component (Inventory Item)
```json
{
  "component_id": "integer (PK, auto-increment)",
  "component_name": "string (required, max 100 chars)",
  "part_number": "string (required, unique, max 50 chars)",
  "current_stock": "integer (required, default 0, CHECK >= 0)",
  "monthly_required_quantity": "integer (required, default 0)",
  "unit": "string (default 'units', max 20 chars)",
  "description": "text (optional)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Business Rules:**
- `current_stock` MUST NEVER be negative (Database constraint enforced)
- `part_number` is unique identifier (duplicate imports rejected)
- Stock updates MUST be within database transaction

---

### Schema 2: PCB Type (Product Definition)
```json
{
  "pcb_type_id": "integer (PK, auto-increment)",
  "pcb_name": "string (required, max 100 chars)",
  "pcb_code": "string (required, unique, max 50 chars)",
  "description": "text (optional)",
  "created_at": "timestamp"
}
```

---

### Schema 3: Bill of Materials (BOM) Mapping
```json
{
  "mapping_id": "integer (PK, auto-increment)",
  "pcb_type_id": "integer (FK -> pcb_types)",
  "component_id": "integer (FK -> components)",
  "quantity_required": "integer (required, CHECK > 0)",
  "CONSTRAINT": "UNIQUE(pcb_type_id, component_id)"
}
```

**Business Rules:**
- Each PCB-Component pair can only exist once
- `quantity_required` defines how many components needed per PCB unit
- Example: PCB-A requires 5x Capacitor C101 → quantity_required = 5

---

### Schema 4: Production Entry (Transaction Trigger)
```json
{
  "production_id": "integer (PK, auto-increment)",
  "pcb_type_id": "integer (FK -> pcb_types)",
  "quantity_produced": "integer (required, CHECK > 0)",
  "production_date": "date (required)",
  "entered_by": "integer (FK -> users)",
  "status": "string (default 'completed', enum: completed|failed)",
  "notes": "text (optional)",
  "created_at": "timestamp"
}
```

**Business Rules:**
- Creating production entry TRIGGERS stock deduction transaction
- If ANY component has insufficient stock → ENTIRE transaction ROLLBACK
- Status 'failed' = insufficient stock detected

---

### Schema 5: Component Transaction (Audit Ledger)
```json
{
  "transaction_id": "integer (PK, auto-increment)",
  "component_id": "integer (FK -> components)",
  "transaction_type": "string (enum: deduction|addition|adjustment)",
  "quantity_changed": "integer (negative for deductions)",
  "balance_after": "integer (snapshot after transaction)",
  "reference_type": "string (production|manual_add|import|adjustment)",
  "reference_id": "integer (optional, links to source record)",
  "remarks": "text (optional)",
  "created_by": "integer (FK -> users)",
  "created_at": "timestamp (immutable)"
}
```

**Business Rules:**
- Immutable audit trail (never delete, never update)
- Every stock change MUST create transaction record
- `quantity_changed` is NEGATIVE for deductions
- `balance_after` preserves historical stock level

---

### Schema 6: Procurement Trigger (Alert System)
```json
{
  "trigger_id": "integer (PK, auto-increment)",
  "component_id": "integer (FK -> components)",
  "triggered_at": "timestamp",
  "current_stock": "integer (stock level when triggered)",
  "required_stock": "integer (20% of monthly_required_quantity)",
  "shortage_quantity": "integer (required_stock - current_stock)",
  "status": "string (default 'pending', enum: pending|acknowledged|ordered)",
  "acknowledged_by": "integer (FK -> users, optional)",
  "acknowledged_at": "timestamp (optional)",
  "notes": "text (optional)"
}
```

**Business Rules:**
- Triggered when: `current_stock < (monthly_required_quantity × 0.20)`
- Only trigger if stock JUST dropped below threshold (prevent duplicates)
- Multiple triggers allowed per component (historical record)

---

### Schema 7: User (Authentication)
```json
{
  "user_id": "integer (PK, auto-increment)",
  "username": "string (required, unique, max 50 chars)",
  "email": "string (required, unique, max 100 chars)",
  "password_hash": "string (required, bcrypt hashed)",
  "full_name": "string (optional, max 100 chars)",
  "role": "string (default 'user', enum: admin|user)",
  "created_at": "timestamp"
}
```

**Security Rules:**
- Passwords MUST be hashed with bcrypt (salt rounds: 10)
- JWT token expires after 7 days
- No plaintext passwords stored anywhere

---

## 🔐 API CONTRACT (Input/Output Payloads)

### Endpoint: POST /api/production/entry

**Input Payload:**
```json
{
  "pcb_type_id": 1,
  "quantity_produced": 100,
  "production_date": "2026-02-14",
  "notes": "Regular production batch"
}
```

**Success Output Payload:**
```json
{
  "success": true,
  "message": "Production entry recorded successfully",
  "production_id": 42,
  "components_deducted": [
    {
      "component_name": "10µF Capacitor",
      "quantity_deducted": 500,
      "new_balance": 1000
    }
  ],
  "procurement_triggers": [
    {
      "component_name": "Resistor 100Ω",
      "current_stock": 80,
      "threshold": 100
    }
  ]
}
```

**Error Output Payload:**
```json
{
  "success": false,
  "error": "Insufficient stock",
  "details": [
    {
      "component_name": "10µF Capacitor",
      "required": 500,
      "available": 300,
      "shortage": 200
    }
  ]
}
```

---

### Endpoint: POST /api/components/import

**Input Payload:** Multipart form-data with Excel file

**Expected Excel Schema:**
| component_name | part_number | current_stock | monthly_required_quantity | unit | description |
|----------------|-------------|---------------|---------------------------|------|-------------|
| 10µF Capacitor | CAP-10UF-001 | 1500 | 5000 | units | Electrolytic capacitor |

**Output Payload:**
```json
{
  "success": true,
  "message": "150 components imported successfully",
  "total_rows": 152,
  "valid_rows": 150,
  "imported": 150,
  "errors": [
    {
      "row": 45,
      "error": "Duplicate part number: CAP-10UF-001"
    }
  ]
}
```

---

### Endpoint: GET /api/dashboard/summary

**Output Payload:**
```json
{
  "success": true,
  "data": {
    "total_components": 150,
    "low_stock_components": 12,
    "total_pcb_types": 8,
    "production_last_7_days": 450,
    "top_consumed_components": [
      {
        "component_name": "10µF Capacitor",
        "total_consumed": 5000,
        "period": "last_30_days"
      }
    ],
    "stock_health": {
      "healthy": 120,
      "warning": 18,
      "critical": 12
    },
    "low_stock_details": [
      {
        "component_name": "Resistor 100Ω",
        "part_number": "RES-100-001",
        "current_stock": 80,
        "monthly_required_quantity": 500,
        "stock_percentage": 16.0
      }
    ]
  }
}
```

---

## ⚖️ BEHAVIORAL RULES (System Personality)

### Critical Business Logic Rules

**Rule 1: Atomic Transactions (Non-Negotiable)**
- Stock deduction MUST be within PostgreSQL transaction block
- If ANY component has insufficient stock → ROLLBACK entire operation
- No partial deductions allowed

**Rule 2: The Negative Stock Prohibition**
- Database constraint: `CHECK (current_stock >= 0)`
- Application-level validation before deduction
- Transaction-level locking: `SELECT FOR UPDATE`

**Rule 3: Procurement Trigger Logic**
```
IF current_stock < (monthly_required_quantity × 0.20):
    CREATE procurement_trigger
    SET shortage_quantity = threshold - current_stock
ENDIF
```
- Only trigger if stock DROPS BELOW threshold (not already below)
- 20% threshold is hardcoded (not configurable in MVP)

**Rule 4: Audit Trail Immutability**
- component_transactions table = append-only ledger
- No DELETE operations allowed
- No UPDATE operations allowed
- Every stock change = new transaction record

**Rule 5: Validation Hierarchy**
1. **Frontend Validation:** Immediate user feedback (UX)
2. **Backend Validation:** Security and business rules enforcement
3. **Database Constraints:** Final safety net (data integrity)

### User Experience Rules

**UX Rule 1: Error Messages Must Be Actionable**
- Bad: "Error occurred"
- Good: "Insufficient stock: Capacitor C101 needs 500, only 300 available"

**UX Rule 2: No Silent Failures**
- Every API error returns detailed error object
- Frontend displays errors prominently
- Console logs for debugging

**UX Rule 3: Progressive Disclosure**
- Dashboard shows summary first
- Details available on drill-down
- Don't overwhelm with data

### Code Quality Rules

**Quality Rule 1: No Magic Numbers**
```javascript
// Bad
if (stock < required * 0.2) { ... }

// Good
const PROCUREMENT_THRESHOLD_PERCENTAGE = 0.20;
if (stock < required * PROCUREMENT_THRESHOLD_PERCENTAGE) { ... }
```

**Quality Rule 2: Named Parameters**
```javascript
// Bad
createProduction(1, 100, '2026-02-14', null);

// Good
createProduction({
  pcb_type_id: 1,
  quantity_produced: 100,
  production_date: '2026-02-14',
  notes: null
});
```

**Quality Rule 3: Early Returns**
```javascript
// Bad
if (valid) {
  // 50 lines of code
} else {
  return error;
}

// Good
if (!valid) {
  return error;
}
// 50 lines of code
```

---

## 🏗️ ARCHITECTURAL INVARIANTS (Structural Laws)

### Database Layer Invariants

**Invariant 1: Connection Pooling**
- Use `pg.Pool` with max 20 connections
- Never use `pg.Client` for multiple queries
- Release connections in `finally` block

**Invariant 2: Parameterized Queries**
```javascript
// Bad (SQL Injection Risk)
const query = `SELECT * FROM components WHERE id = ${req.params.id}`;

// Good
const query = 'SELECT * FROM components WHERE component_id = $1';
await pool.query(query, [req.params.id]);
```

**Invariant 3: Transaction Pattern**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### API Layer Invariants

**Invariant 1: Consistent Response Structure**
```javascript
// Success
{ success: true, data: {...}, message?: string }

// Error
{ success: false, error: string, details?: any }
```

**Invariant 2: JWT Middleware Protection**
- All `/api/*` routes except `/api/auth/*` require JWT
- Token extracted from `Authorization: Bearer <token>` header
- Invalid token → 401 Unauthorized

**Invariant 3: Input Validation**
- Use express-validator for all POST/PUT endpoints
- Validate data types, ranges, required fields
- Return 400 Bad Request for validation errors

### Frontend Layer Invariants

**Invariant 1: Centralized API Client**
```javascript
// All API calls go through services/api.js
import api from '../services/api';
const response = await api.post('/production/entry', data);
```

**Invariant 2: Authentication State Management**
- Use React Context for user authentication state
- Store JWT in localStorage
- Clear token on logout or 401 response

**Invariant 3: Error Boundary**
- Wrap app in error boundary component
- Catch and display runtime errors gracefully
- Prevent white screen of death

---

## 🧪 TESTING BOUNDARIES

### Critical Test Cases (Must Pass)

**Test 1: Atomic Transaction Rollback**
```
GIVEN: Component has 100 units stock
WHEN: Production requires 200 units
THEN: 
  - Production entry fails
  - Component stock remains 100 (unchanged)
  - No transaction record created
```

**Test 2: Concurrent Production Entries**
```
GIVEN: Component has 500 units stock
WHEN: User A produces PCB requiring 300 units
  AND: User B produces PCB requiring 300 units simultaneously
THEN:
  - First transaction succeeds (stock = 200)
  - Second transaction fails (insufficient stock)
  - Final stock = 200 (not -100)
```

**Test 3: Procurement Trigger Creation**
```
GIVEN: Component has 1000 stock, 5000 monthly required (20% = 1000)
WHEN: Production deducts 50 units (new stock = 950)
THEN:
  - Procurement trigger created
  - trigger.current_stock = 950
  - trigger.required_stock = 1000
  - trigger.shortage_quantity = 50
```

**Test 4: Excel Import Validation**
```
GIVEN: Excel file with 100 rows
WHEN: Row 45 has duplicate part_number
  AND: Row 67 has negative current_stock
THEN:
  - 98 valid rows imported
  - errors array contains 2 items
  - Duplicate and negative stock rows rejected
```

### Edge Cases to Handle

1. **Zero Monthly Requirement:** Skip procurement trigger logic
2. **Duplicate Import:** Skip row silently (ON CONFLICT DO NOTHING)
3. **Empty Excel File:** Return error before processing
4. **Invalid Date Format:** Return 400 validation error
5. **Extremely Large Production:** Verify performance with 1000+ components

---

## 📁 FILE STRUCTURE (System Organization)

```
invictus-inventory/
│
├── gemini.md                    # THIS FILE (Project Constitution)
├── task_plan.md                 # Sprint planning and checklists
├── findings.md                  # Research discoveries and constraints
├── progress.md                  # Daily work log and error tracking
│
├── backend/
│   ├── server.js               # Express app entry point
│   ├── .env                    # Environment variables (gitignored)
│   │
│   ├── config/
│   │   └── database.js         # PostgreSQL pool configuration
│   │
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   ├── errorHandler.js    # Centralized error handling
│   │   └── upload.js          # Multer configuration
│   │
│   ├── controllers/           # Business logic layer
│   │   ├── authController.js
│   │   ├── componentController.js
│   │   ├── pcbController.js
│   │   ├── productionController.js
│   │   ├── dashboardController.js
│   │   └── reportController.js
│   │
│   ├── routes/                # API endpoint definitions
│   │   ├── authRoutes.js
│   │   ├── componentRoutes.js
│   │   ├── pcbRoutes.js
│   │   ├── productionRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── reportRoutes.js
│   │
│   ├── utils/                 # Helper functions
│   │   ├── validators.js      # Input validation schemas
│   │   ├── queryHelpers.js    # Common SQL queries
│   │   └── excelHelpers.js    # Excel parsing utilities
│   │
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   │
│   ├── src/
│   │   ├── App.js             # Root component
│   │   ├── index.js           # React entry point
│   │   │
│   │   ├── components/        # React components
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Layout.jsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardHome.jsx
│   │   │   │   ├── StockHealthChart.jsx
│   │   │   │   ├── ConsumptionChart.jsx
│   │   │   │   └── LowStockTable.jsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ComponentList.jsx
│   │   │   │   ├── ComponentForm.jsx
│   │   │   │   ├── ComponentDetail.jsx
│   │   │   │   └── ComponentImport.jsx
│   │   │   │
│   │   │   ├── pcb/
│   │   │   │   ├── PCBTypeList.jsx
│   │   │   │   ├── PCBTypeForm.jsx
│   │   │   │   └── BOMBuilder.jsx
│   │   │   │
│   │   │   ├── production/
│   │   │   │   ├── ProductionEntry.jsx
│   │   │   │   ├── ProductionHistory.jsx
│   │   │   │   └── ProductionDetail.jsx
│   │   │   │
│   │   │   ├── procurement/
│   │   │   │   ├── ProcurementList.jsx
│   │   │   │   └── ProcurementDetail.jsx
│   │   │   │
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.jsx
│   │   │       ├── ErrorMessage.jsx
│   │   │       └── ConfirmDialog.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js         # Axios configuration
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.js # User authentication state
│   │   │
│   │   ├── utils/
│   │   │   ├── formatters.js  # Data formatting utilities
│   │   │   └── validators.js  # Frontend validation
│   │   │
│   │   └── styles/
│   │       └── App.css        # Global styles
│   │
│   └── package.json
│
├── database/
│   ├── schema.sql             # Database creation script
│   ├── seed.sql               # Sample data for testing
│   ├── indexes.sql            # Performance indexes
│   └── migrations/            # Schema version control
│
├── uploads/                   # Temporary file storage (gitignored)
├── .tmp/                      # Temporary workbench (gitignored)
├── .gitignore
└── README.md                  # Setup instructions
```

---

## 🔄 SELF-ANNEALING LOOP (Error Repair Protocol)

### When Tool Fails:

**Step 1: Analyze**
- Read full stack trace
- Identify root cause (not symptoms)
- Check if error is in: Database / API / Logic / Frontend

**Step 2: Patch**
- Fix the specific file causing error
- Do NOT refactor unrelated code
- Keep changes minimal and targeted

**Step 3: Test**
- Verify fix with same input that caused failure
- Test edge cases around the fix
- Check for regression in related features

**Step 4: Document**
- Update `progress.md` with error and solution
- Add to `findings.md` if architectural learning
- Update API documentation if contract changed

### Known Error Patterns (Prevention Database)

**Pattern 1: "Cannot read property of undefined"**
- Cause: Missing null check before accessing nested property
- Fix: Use optional chaining `object?.property?.nested`
- Prevention: Always validate API response structure

**Pattern 2: "duplicate key value violates unique constraint"**
- Cause: Attempting to insert existing part_number
- Fix: Use `ON CONFLICT DO NOTHING` or pre-check existence
- Prevention: Frontend validation + backend uniqueness check

**Pattern 3: "relation does not exist"**
- Cause: Missing database table or wrong schema
- Fix: Verify schema.sql executed correctly
- Prevention: Add database connection test on startup

**Pattern 4: "ECONNREFUSED" on API calls**
- Cause: Backend server not running or wrong port
- Fix: Verify backend running on correct port
- Prevention: Frontend .env validation on startup

**Pattern 5: "Token expired or invalid"**
- Cause: JWT expiration or wrong secret key
- Fix: Regenerate token or verify JWT_SECRET matches
- Prevention: Implement token refresh mechanism

---

## 🎯 DELIVERABLE CHECKLIST

### Phase 1: Blueprint ✅ (Current Stage)
- [x] Discovery questions answered
- [x] Data schemas defined in gemini.md
- [x] API contracts documented
- [x] Behavioral rules established

### Phase 2: Link (Connectivity)
- [ ] PostgreSQL database created
- [ ] Backend server running and accessible
- [ ] Frontend connecting to backend API
- [ ] JWT authentication working
- [ ] File upload endpoint tested

### Phase 3: Architect (Build)
- [ ] Database schema applied (schema.sql)
- [ ] All API endpoints implemented
- [ ] Component CRUD operations working
- [ ] PCB type management working
- [ ] Production entry with stock deduction working
- [ ] Procurement trigger logic working
- [ ] Excel import functional
- [ ] Excel export functional
- [ ] Dashboard analytics displaying
- [ ] Transaction safety verified

### Phase 4: Stylize (Refinement)
- [ ] Frontend UI polished (minimal but clean)
- [ ] Error messages actionable
- [ ] Loading states implemented
- [ ] Success confirmations showing
- [ ] Dashboard charts rendering correctly

### Phase 5: Trigger (Deployment)
- [ ] README.md with setup instructions
- [ ] Sample data seeded
- [ ] Demo credentials created
- [ ] Docker configuration (optional bonus)
- [ ] Live demo rehearsed

---

## 🚨 RED FLAGS (System Alerts)

### Critical Errors (Stop Development)
- ❌ Negative inventory value observed in database
- ❌ Stock deduction without transaction record
- ❌ Procurement trigger created above 20% threshold
- ❌ Production entry succeeds despite insufficient stock

### Warning Signs (Fix Before Demo)
- ⚠️ API response time > 2 seconds
- ⚠️ Excel import fails on valid file
- ⚠️ Dashboard showing stale data
- ⚠️ Concurrent requests causing race conditions

### Technical Debt (Post-Hackathon)
- 🔧 No email notifications for procurement
- 🔧 No barcode scanning support
- 🔧 Single-location warehouse assumption
- 🔧 No cost tracking per component

---

## 📊 MAINTENANCE LOG

### Version History

**v1.0 - February 14, 2026**
- Initial project constitution created
- All schemas defined
- API contracts documented
- Behavioral rules established

---

## 🎓 JUDGE APPEAL STRATEGY

### What Judges Value (Priority Order)
1. **Correctness of Logic:** Stock deduction math, transaction safety
2. **Data Integrity:** No negative inventory, proper constraints
3. **System Reliability:** Handles errors gracefully, no crashes
4. **Adherence to Stack:** 100% compliance with mandatory tech stack
5. **Feature Completeness:** All 4 core features working

### What Judges Don't Care About
- Fancy animations or gradients
- Multiple user roles (keep it simple)
- AI/ML forecasting
- Payment integration
- Advanced RBAC

### Demo Script (5-Minute Winning Presentation)
1. **Login** (10 sec) - Show JWT auth works
2. **Excel Import** (30 sec) - Upload 50 components, show validation
3. **Create PCB Type** (30 sec) - Define BOM with 3 components
4. **Production Entry** (60 sec) - Show dry run, then execute
5. **Dashboard** (60 sec) - Point out stock deduction, procurement trigger
6. **Concurrent Test** (60 sec) - Two tabs, prove no race condition
7. **Export Report** (30 sec) - Download Excel with results
8. **Database View** (30 sec) - Open pgAdmin, show transaction ledger
9. **Closing** (30 sec) - "This prevents production stops, maintains audit trails, handles concurrency—all with your required stack."

---

**END OF PROJECT CONSTITUTION**

*This document is the single source of truth for the Invictus Hackathon project. All code, decisions, and architecture must align with the rules defined here.*
