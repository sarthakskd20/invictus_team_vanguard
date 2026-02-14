# 📋 TASK PLAN - Invictus Hackathon
## Component-Level Inventory Management System

**Sprint Duration:** 48 Hours  
**Framework:** B.L.A.S.T. Protocol  
**Last Updated:** February 14, 2026

---

## 🎯 SPRINT OVERVIEW

### Mission
Build a transaction-safe inventory management system that automatically tracks component consumption during PCB production.

### Success Criteria
- ✅ All core features working
- ✅ Zero negative inventory values
- ✅ Correct 20% procurement triggers
- ✅ Excel import/export functional
- ✅ Live demo ready

---

## 📊 PHASE BREAKDOWN (48-Hour Timeline)

### Phase 1: B - BLUEPRINT [COMPLETED] ✅
**Duration:** 2 hours (Hours 0-2)  
**Status:** DONE

**Completed Tasks:**
- [x] Discovery questions answered
- [x] Data schemas defined
- [x] API contracts documented
- [x] Behavioral rules established
- [x] `gemini.md` created as Project Constitution

---

### Phase 2: L - LINK (Connectivity & Setup)
**Duration:** 4 hours (Hours 2-6)  
**Status:** PENDING

#### Checkpoint 2.1: Environment Setup [2 hours]
- [ ] Install Node.js 18+ and verify version
- [ ] Install PostgreSQL 15+ and verify version
- [ ] Create project directories (backend/, frontend/, database/)
- [ ] Initialize backend with `npm init`
- [ ] Initialize frontend with `create-react-app`
- [ ] Create `.env` files in both backend and frontend
- [ ] Create `.gitignore` files

**Deliverable:** Project structure exists, dependencies installed

---

#### Checkpoint 2.2: Database Connection [1 hour]
- [ ] Create PostgreSQL database: `invictus_inventory`
- [ ] Test connection from backend using `pg` client
- [ ] Create `config/database.js` with connection pool
- [ ] Write simple test query to verify connectivity
- [ ] Document database credentials in `.env`

**Deliverable:** Backend successfully queries PostgreSQL

---

#### Checkpoint 2.3: Backend Foundation [1 hour]
- [ ] Install Express.js, pg, bcrypt, jsonwebtoken, cors, dotenv
- [ ] Create basic Express server in `server.js`
- [ ] Set up CORS middleware
- [ ] Create health check endpoint: `GET /health`
- [ ] Test server starts without errors
- [ ] Verify health endpoint responds

**Deliverable:** Express server running on http://localhost:5000

---

### Phase 3: A - ARCHITECT (The 3-Layer Build)
**Duration:** 24 hours (Hours 6-30)  
**Status:** PENDING

---

#### Checkpoint 3.1: Database Schema [2 hours]
- [ ] Create `database/schema.sql` with all 7 tables
- [ ] Add database constraints (CHECK, UNIQUE, FOREIGN KEY)
- [ ] Create indexes for performance
- [ ] Execute schema.sql on database
- [ ] Verify all tables created correctly with `\dt` command
- [ ] Create `database/seed.sql` with sample data (10 components, 2 PCB types)

**Deliverable:** Database structure ready with test data

**Tables to Create:**
1. users
2. components
3. pcb_types
4. pcb_components_mapping
5. production_entries
6. component_transactions
7. procurement_triggers

---

#### Checkpoint 3.2: Authentication System [3 hours]

**Task 3.2.1: User Registration** [1 hour]
- [ ] Create `controllers/authController.js`
- [ ] Implement `register` function with bcrypt hashing
- [ ] Create `routes/authRoutes.js`
- [ ] Add POST `/api/auth/register` endpoint
- [ ] Test with Postman: Create user successfully
- [ ] Verify password hashed in database

**Task 3.2.2: User Login & JWT** [1.5 hours]
- [ ] Implement `login` function in authController
- [ ] Generate JWT token on successful login
- [ ] Return user data + token in response
- [ ] Add POST `/api/auth/login` endpoint
- [ ] Test with Postman: Login returns valid JWT
- [ ] Decode JWT at jwt.io to verify payload

**Task 3.2.3: JWT Middleware** [0.5 hours]
- [ ] Create `middleware/auth.js`
- [ ] Implement token verification middleware
- [ ] Extract user ID from token and attach to `req.user`
- [ ] Test protected route returns 401 without token
- [ ] Test protected route succeeds with valid token

**Deliverable:** Auth system working end-to-end

---

#### Checkpoint 3.3: Component Management [4 hours]

**Task 3.3.1: Component CRUD Backend** [2 hours]
- [ ] Create `controllers/componentController.js`
- [ ] Implement `getAllComponents` with pagination
- [ ] Implement `getComponentById`
- [ ] Implement `createComponent` with validation
- [ ] Implement `updateComponent`
- [ ] Create `routes/componentRoutes.js`
- [ ] Add all component endpoints
- [ ] Test all endpoints with Postman

**Task 3.3.2: Component Frontend** [2 hours]
- [ ] Create `services/api.js` with Axios instance
- [ ] Configure JWT token in Axios headers
- [ ] Create `components/components/ComponentList.jsx`
- [ ] Create `components/components/ComponentForm.jsx`
- [ ] Implement add/edit/view functionality
- [ ] Test component creation from UI
- [ ] Verify data appears in database

**Deliverable:** Full component management working

---

#### Checkpoint 3.4: PCB Type Management [3 hours]

**Task 3.4.1: PCB Backend** [1.5 hours]
- [ ] Create `controllers/pcbController.js`
- [ ] Implement `getAllPCBTypes`
- [ ] Implement `createPCBType` with BOM mapping
- [ ] Create transaction to insert PCB + mappings atomically
- [ ] Create `routes/pcbRoutes.js`
- [ ] Test creating PCB with 3 components in BOM

**Task 3.4.2: PCB Frontend** [1.5 hours]
- [ ] Create `components/pcb/PCBTypeList.jsx`
- [ ] Create `components/pcb/PCBTypeForm.jsx`
- [ ] Create `components/pcb/BOMBuilder.jsx` (component selector)
- [ ] Implement multi-select component picker
- [ ] Test creating PCB type with BOM from UI

**Deliverable:** PCB types with Bill of Materials working

---

#### Checkpoint 3.5: Production Entry (CRITICAL) [6 hours]

**Task 3.5.1: Production Backend Logic** [3 hours]
- [ ] Create `controllers/productionController.js`
- [ ] Implement `createProductionEntry` with full transaction logic
- [ ] Fetch BOM for selected PCB type
- [ ] Calculate total component requirements
- [ ] Validate sufficient stock for ALL components
- [ ] If insufficient → ROLLBACK with error details
- [ ] If sufficient → Deduct stock, create transaction logs
- [ ] Check procurement threshold for each component
- [ ] Create procurement triggers where needed
- [ ] Test with sufficient stock - should succeed
- [ ] Test with insufficient stock - should fail and rollback

**Task 3.5.2: Production Frontend** [2 hours]
- [ ] Create `components/production/ProductionEntry.jsx`
- [ ] PCB type dropdown (fetch from API)
- [ ] Quantity input + date picker
- [ ] Show confirmation dialog with component deductions
- [ ] Handle success: Show deduction summary + procurement alerts
- [ ] Handle error: Display which components are short
- [ ] Test production flow end-to-end

**Task 3.5.3: Concurrent Transaction Test** [1 hour]
- [ ] Open two browser tabs
- [ ] Component has 500 stock, PCB requires 300 per unit
- [ ] Tab 1: Produce 1 PCB (deduct 300)
- [ ] Tab 2: Simultaneously produce 1 PCB (should fail)
- [ ] Verify final stock = 200 (not -100)
- [ ] Document test results in `findings.md`

**Deliverable:** Transaction-safe production entry working

---

#### Checkpoint 3.6: Excel Import/Export [4 hours]

**Task 3.6.1: Excel Import Backend** [2 hours]
- [ ] Install `multer` and `xlsx` packages
- [ ] Create `middleware/upload.js` with Multer config
- [ ] Implement `importComponents` in componentController
- [ ] Parse Excel file using xlsx library
- [ ] Validate each row (required fields, data types)
- [ ] Collect validation errors
- [ ] Insert valid rows with transaction
- [ ] Handle duplicate part_numbers gracefully
- [ ] Return summary: imported count + errors array
- [ ] Test with sample Excel file (50 rows)

**Task 3.6.2: Excel Export Backend** [1 hour]
- [ ] Install `exceljs` package
- [ ] Create `controllers/reportController.js`
- [ ] Implement `exportInventory` function
- [ ] Query all components with stock status
- [ ] Generate Excel with formatted columns
- [ ] Color-code rows (red=critical, orange=warning)
- [ ] Set response headers for file download
- [ ] Test export downloads correctly

**Task 3.6.3: Excel Frontend** [1 hour]
- [ ] Create `components/components/ComponentImport.jsx`
- [ ] File input with Excel file validation
- [ ] Upload progress indicator
- [ ] Display import results (success count, errors)
- [ ] Add "Export Inventory" button to component list
- [ ] Trigger file download on export
- [ ] Test import/export flow

**Deliverable:** Bulk operations via Excel working

---

#### Checkpoint 3.7: Dashboard Analytics [3 hours]

**Task 3.7.1: Dashboard Backend** [1.5 hours]
- [ ] Create `controllers/dashboardController.js`
- [ ] Implement `getDashboardSummary` with complex queries
- [ ] Query: Total components, low stock count, PCB types
- [ ] Query: Production last 7 days
- [ ] Query: Top 10 consumed components (30 days)
- [ ] Query: Stock health distribution
- [ ] Query: Low stock component details
- [ ] Test endpoint returns complete data

**Task 3.7.2: Dashboard Frontend** [1.5 hours]
- [ ] Install `chart.js` and `react-chartjs-2`
- [ ] Create `components/dashboard/DashboardHome.jsx`
- [ ] Display summary cards (total, low stock, production)
- [ ] Create `components/dashboard/StockHealthChart.jsx` (pie chart)
- [ ] Create `components/dashboard/LowStockTable.jsx`
- [ ] Create `components/dashboard/TopConsumedTable.jsx`
- [ ] Test dashboard displays all analytics correctly

**Deliverable:** Analytics dashboard functional

---

#### Checkpoint 3.8: Procurement Management [2 hours]

**Task 3.8.1: Procurement Backend** [1 hour]
- [ ] Create `controllers/procurementController.js`
- [ ] Implement `getAllTriggers` with status filter
- [ ] Implement `acknowledgeTrigger` to mark as acknowledged
- [ ] Create `routes/procurementRoutes.js`
- [ ] Test fetching pending triggers

**Task 3.8.2: Procurement Frontend** [1 hour]
- [ ] Create `components/procurement/ProcurementList.jsx`
- [ ] Display triggers in table (component, shortage, date)
- [ ] Add "Acknowledge" button
- [ ] Filter by status (pending/acknowledged)
- [ ] Test acknowledging a trigger

**Deliverable:** Procurement alert system working

---

#### Checkpoint 3.9: Production History [1 hour]
- [ ] Create `getProductionHistory` in productionController
- [ ] Query with date range filters
- [ ] Include PCB details and component deductions
- [ ] Create `components/production/ProductionHistory.jsx`
- [ ] Display production entries in table
- [ ] Show component deductions on row expand
- [ ] Test history displays correctly

**Deliverable:** Production audit trail visible

---

### Phase 4: S - STYLIZE (Refinement)
**Duration:** 6 hours (Hours 30-36)  
**Status:** PENDING

---

#### Checkpoint 4.1: UI Polish [3 hours]

**Task 4.1.1: Layout & Navigation** [1 hour]
- [ ] Create `components/layout/Navbar.jsx`
- [ ] Create `components/layout/Sidebar.jsx`
- [ ] Create `components/layout/Layout.jsx` wrapper
- [ ] Add navigation links (Dashboard, Components, PCB, Production)
- [ ] Add logout button
- [ ] Apply basic CSS styling (clean, minimal)

**Task 4.1.2: Common Components** [1 hour]
- [ ] Create `components/common/LoadingSpinner.jsx`
- [ ] Create `components/common/ErrorMessage.jsx`
- [ ] Create `components/common/ConfirmDialog.jsx`
- [ ] Use throughout app for consistency

**Task 4.1.3: Form Validation & UX** [1 hour]
- [ ] Add frontend validation to all forms
- [ ] Show validation errors inline
- [ ] Disable submit buttons during API calls
- [ ] Show success messages after operations
- [ ] Add loading states to all buttons

**Deliverable:** Professional-looking UI without fancy animations

---

#### Checkpoint 4.2: Error Handling [2 hours]
- [ ] Implement error boundary component
- [ ] Add try-catch to all API calls
- [ ] Display actionable error messages
- [ ] Handle 401 errors (redirect to login)
- [ ] Handle 400 errors (show validation feedback)
- [ ] Handle 500 errors (show generic message)
- [ ] Test error scenarios: network failure, server error, validation

**Deliverable:** Robust error handling throughout app

---

#### Checkpoint 4.3: Data Formatting [1 hour]
- [ ] Create `utils/formatters.js`
- [ ] Implement date formatting (YYYY-MM-DD display)
- [ ] Implement number formatting (1000 → 1,000)
- [ ] Implement percentage formatting (0.2 → 20%)
- [ ] Implement stock status badges (healthy, warning, critical)
- [ ] Apply formatters throughout UI

**Deliverable:** Consistent data presentation

---

### Phase 5: T - TRIGGER (Deployment Prep)
**Duration:** 6 hours (Hours 36-42)  
**Status:** PENDING

---

#### Checkpoint 5.1: Documentation [2 hours]

**Task 5.1.1: README.md** [1 hour]
- [ ] Project overview
- [ ] Technology stack
- [ ] Prerequisites
- [ ] Backend setup instructions
- [ ] Frontend setup instructions
- [ ] Database setup instructions
- [ ] Environment variables documentation
- [ ] Running the application
- [ ] Demo credentials
- [ ] Troubleshooting section

**Task 5.1.2: API Documentation** [1 hour]
- [ ] Create `API_DOCUMENTATION.md`
- [ ] Document all endpoints with examples
- [ ] Include request/response formats
- [ ] Add Postman collection export (optional)

**Deliverable:** Complete setup documentation

---

#### Checkpoint 5.2: Sample Data & Seeding [1 hour]
- [ ] Create comprehensive `database/seed.sql`
- [ ] Add 50 diverse components
- [ ] Add 5 PCB types with realistic BOMs
- [ ] Add 10 production entries
- [ ] Add component transactions
- [ ] Add procurement triggers
- [ ] Create demo user account
- [ ] Test fresh database setup with seed data

**Deliverable:** Database ready for demo

---

#### Checkpoint 5.3: Testing & Bug Fixes [2 hours]

**Critical Test Scenarios:**
- [ ] **Test 1:** Fresh install on clean machine
- [ ] **Test 2:** Register new user
- [ ] **Test 3:** Login with demo credentials
- [ ] **Test 4:** Import 50 components via Excel
- [ ] **Test 5:** Create PCB with 5 components in BOM
- [ ] **Test 6:** Successful production entry
- [ ] **Test 7:** Failed production (insufficient stock)
- [ ] **Test 8:** Verify procurement trigger created
- [ ] **Test 9:** Dashboard displays correct analytics
- [ ] **Test 10:** Export inventory to Excel
- [ ] **Test 11:** Concurrent production entries
- [ ] **Test 12:** Logout and login again

**Bug Fix Protocol:**
- Document each bug in `progress.md`
- Fix bug
- Re-test scenario
- Mark as resolved

**Deliverable:** All critical flows working

---

#### Checkpoint 5.4: Demo Rehearsal [1 hour]
- [ ] Write demo script (5 minutes)
- [ ] Practice demo flow 3 times
- [ ] Time each section
- [ ] Prepare fallback data if live demo fails
- [ ] Record demo video (backup)
- [ ] Prepare 3 judge questions + answers

**Demo Script:**
1. Login (10s)
2. Excel Import (30s)
3. Create PCB Type (30s)
4. Production Entry (60s)
5. Dashboard View (60s)
6. Concurrent Test (60s)
7. Export Report (30s)
8. Database View (30s)
9. Closing Statement (30s)

**Deliverable:** Confident demo presentation

---

### Phase 6: Buffer & Polish
**Duration:** 6 hours (Hours 42-48)  
**Status:** PENDING

#### Checkpoint 6.1: Final Polish [3 hours]
- [ ] Fix any remaining minor bugs
- [ ] Improve loading states
- [ ] Add tooltips where helpful
- [ ] Ensure responsive design (basic)
- [ ] Test on different browsers
- [ ] Clean up console.log statements
- [ ] Remove unused code/imports

#### Checkpoint 6.2: Submission Preparation [2 hours]
- [ ] Create project zip file
- [ ] Test extraction and setup
- [ ] Verify README instructions work
- [ ] Prepare submission form data
- [ ] Take screenshots for presentation
- [ ] Write project description (200 words)

#### Checkpoint 6.3: Contingency Time [1 hour]
- [ ] Reserved for unexpected issues
- [ ] Last-minute critical bug fixes
- [ ] Final testing before submission

---

## 🚨 RISK MITIGATION

### High-Risk Areas (Focus Effort Here)

**Risk 1: Transaction Logic Failure**
- **Impact:** Critical - Core requirement
- **Mitigation:** Implement early (Hour 12-18), test extensively
- **Fallback:** None - this must work

**Risk 2: Concurrent Transaction Race Condition**
- **Impact:** High - Judge evaluation point
- **Mitigation:** Use `SELECT FOR UPDATE`, test with 2 browser tabs
- **Fallback:** Document known limitation if can't fix

**Risk 3: Excel Import/Export Breaks**
- **Impact:** Medium - Feature requirement
- **Mitigation:** Use stable libraries, validate file format
- **Fallback:** Manual data entry still works

**Risk 4: Database Connection Issues**
- **Impact:** Critical - Nothing works without DB
- **Mitigation:** Test connection early (Hour 3), use connection pooling
- **Fallback:** Use SQLite for demo (violates rules - avoid)

**Risk 5: Time Overrun**
- **Impact:** High - Incomplete submission
- **Mitigation:** Strict time-boxing, skip non-essential features
- **Fallback:** Focus on core 4 features, skip procurement acknowledgment

---

## 📊 PROGRESS TRACKING

### Daily Standups

**Day 1 - End of Day Review (Hour 24)**
- [ ] Database schema complete?
- [ ] Authentication working?
- [ ] Component + PCB management functional?
- [ ] Production entry logic implemented?
- [ ] Blockers identified?

**Day 2 - Mid-Day Review (Hour 36)**
- [ ] Excel import/export working?
- [ ] Dashboard analytics displaying?
- [ ] UI polished?
- [ ] Critical bugs fixed?
- [ ] Demo script prepared?

**Day 2 - Final Review (Hour 46)**
- [ ] All features working?
- [ ] Demo rehearsed?
- [ ] Documentation complete?
- [ ] Submission ready?

---

## ✅ DEFINITION OF DONE

### Feature Completion Criteria

**Component Management:**
- ✅ Can add component manually
- ✅ Can edit component
- ✅ Can view component list with pagination
- ✅ Can import via Excel
- ✅ Can export to Excel

**PCB Management:**
- ✅ Can create PCB type
- ✅ Can define BOM (component mapping)
- ✅ Can view PCB list with components

**Production Entry:**
- ✅ Can create production entry
- ✅ Stock deducted atomically
- ✅ Insufficient stock prevents production
- ✅ Transaction log created
- ✅ Procurement trigger created at 20% threshold

**Dashboard:**
- ✅ Shows summary statistics
- ✅ Shows top consumed components
- ✅ Shows low stock components
- ✅ Data updates after production entry

**General:**
- ✅ Login/logout works
- ✅ JWT authentication secure
- ✅ All API errors handled gracefully
- ✅ UI is clean and usable
- ✅ README has complete setup instructions

---

## 🎯 MINIMUM VIABLE DEMO (If Time Constrained)

### Absolute Must-Haves (4 hours before deadline)
1. Login works
2. Can add components (manually or Excel)
3. Can create PCB with BOM
4. Production entry deducts stock correctly
5. Dashboard shows at least total components + low stock count

### Nice-to-Haves (Can skip if tight on time)
- Procurement acknowledgment feature
- Production history detailed view
- Advanced charts
- Responsive mobile design

---

## 📞 EMERGENCY CONTACTS

### Technical Blockers Escalation
- Database issues → Check PostgreSQL logs
- Backend crashes → Check server.js console
- Frontend blank screen → Check browser console
- API 500 errors → Check backend logs

### Knowledge Resources
- PostgreSQL transactions: https://node-postgres.com/features/transactions
- JWT authentication: https://jwt.io/introduction
- Excel.js documentation: https://github.com/exceljs/exceljs
- React Chart.js: https://react-chartjs-2.js.org/

---

**END OF TASK PLAN**

*Update `progress.md` after each checkpoint completion. Update `findings.md` when discovering new constraints or solutions.*
