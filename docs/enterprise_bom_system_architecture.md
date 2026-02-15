# Enterprise PCB Schematic → BOM → Inventory System

## 1. System Overview

An end-to-end module within a manufacturing ecosystem that ingests PCB design files of **any format**, extracts every component, generates a standardized BOM, scales quantities to production volumes, deducts stock, and outputs procurement alerts — all through a single upload-to-export flow.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  File Upload │────▶│  Parse &     │────▶│  BOM Engine  │────▶│  Inventory   │────▶│  Excel /     │
│  (.sch, .gbr │     │  Normalize   │     │  (Dedupe,    │     │  Engine      │     │  Reports     │
│   .pdf, etc) │     │  Pipeline    │     │   Enrich)    │     │  (Deduct,    │     │  (BOM, Stock │
│              │     │              │     │              │     │   Alert)     │     │   Shortage)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Key Capabilities:**
- 15+ input format support (Eagle, KiCad, Altium, Gerber, PDF, CSV, IPC-2581, ODB++)
- 4-layer smart categorization (value regex → keywords → part-number → ref designator)
- Production volume scaling with real-time shortage detection
- Editable preview with user confirmation before any stock mutations
- Excel import/export for offline workflows

---

## 2. Architecture

### 2.1 High-Level Architecture

```
                         ┌─────────────────────────────────────┐
                         │          Frontend (React)            │
                         │  Upload → Preview → Edit → Confirm  │
                         └──────────────┬──────────────────────┘
                                        │ REST API
                         ┌──────────────▼──────────────────────┐
                         │        API Gateway / Router          │
                         │   Auth · Rate Limit · File Upload    │
                         └──────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
   ┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌──────────▼──────────┐
   │  Parsing Service    │   │  BOM Service         │   │  Inventory Service  │
   │  (Python)           │   │  (Node.js)           │   │  (Node.js)          │
   │                     │   │                      │   │                     │
   │  • File detection   │   │  • Deduplication     │   │  • Stock queries    │
   │  • Format parsers   │   │  • MPN enrichment    │   │  • Deduction engine │
   │  • Normalization    │   │  • Categorization    │   │  • Shortage alerts  │
   │  • OCR (PDF)        │   │  • Excel generation  │   │  • Procurement gen  │
   └─────────────────────┘   └──────────────────────┘   └─────────────────────┘
              │                         │                         │
              └─────────────────────────┼─────────────────────────┘
                                        │
                         ┌──────────────▼──────────────────────┐
                         │          PostgreSQL Database         │
                         │  components · pcb_types · bom_map   │
                         │  production_entries · transactions   │
                         └─────────────────────────────────────┘
```

### 2.2 Monolith vs Microservice Decision

**Current approach: Modular Monolith** — single Node.js backend with Python subprocess for parsing.

| Criterion | Monolith | Microservices |
|---|---|---|
| Deployment complexity | ✅ Low | ❌ High |
| Team size ≤5 | ✅ Ideal | ❌ Overkill |
| Parsing isolation | ✅ Python subprocess | ✅ Separate container |
| Scaling path | ➡️ Extract parsing service first | ✅ Independent scaling |

**Migration path:** When parsing load increases, extract the Python parser into a standalone service with a message queue (Redis/RabbitMQ) between the Node API and Python workers.

---

## 3. File Parsing Methods

### 3.1 Unified Intermediate Data Model

Every parser outputs this normalized structure:

```json
{
  "reference": "R1",         
  "value": "10kΩ",           
  "footprint": "0603",       
  "part_number": "RC0603FR-0710KL",
  "description": "Resistor, Thick Film, 10kΩ ±1%",
  "manufacturer": "Yageo",
  "mounting_type": "SMD",
  "tolerance": "1%",
  "voltage_rating": "",
  "dni": false,
  "variant": "default"
}
```

### 3.2 Format-by-Format Parsing Strategy

| Format | Extension(s) | Parser | Extraction Method |
|---|---|---|---|
| **Eagle** | `.sch`, `.brd`, `.xml` | `EagleParser` (Python) | XML DOM traversal (`<parts><part>` nodes). Attributes extracted from `<attribute>` children. |
| **KiCad** | `.kicad_sch`, `.kicad_pcb`, `.net`, `.xml` | `KiCadParser` (Python) | S-expression regex parsing for `(symbol ...)` blocks. Properties extracted: Reference, Value, Footprint, MPN. |
| **KiCad BOM CSV** | `.csv` | `CSVBOMParser` | Direct CSV column mapping with header detection (flexible keywords). |
| **Altium** | `.SchDoc`, `.PcbDoc`, `.BomDoc` | `AltiumParser` (Python) | Binary compound file text extraction. Regex: `Designator=...Comment=...`. |
| **Altium OutJob** | `.OutJob` | Same as above | Contains BOM generation configs; extract parameters to feed into Altium CLI export if available. |
| **EasyEDA** | `.json` | `EasyEDAParser` (Python) | JSON traversal. Components have `gge='LIB'` with `attrs` containing Designator, Value, Footprint, MPN. |
| **OrCAD/Allegro** | Netlists, BOM exports | `CSVBOMParser` / `TextParser` | Tab/comma-delimited netlist parsing or structured BOM CSV. |
| **Gerber** | `.gbr` | `GerberParser` (Python) | G04 comment extraction, pick-and-place CSV lines, ref designator regex fallback. Limited component data. |
| **Pick-and-Place** | `.csv`, `.pos`, `.xy` | `CSVBOMParser` | Column mapping (RefDes, Footprint, X, Y, Side). No values — relies on cross-referencing. |
| **PDF** | `.pdf` | `PDFParser` (Python) | `pdfplumber` table extraction → column mapping. Fallback: raw text regex for ref designators + values. |
| **PDF (scanned)** | `.pdf` (image-based) | `OCRPDFParser` | Tesseract OCR → text extraction → same regex pipeline. Symbol recognition AI optional enhancement. |
| **IPC-2581** | `.xml`, `.cvg` | `IPC2581Parser` | XML parsing of `<BOM>` and `<Component>` sections per IPC-2581 schema specification. |
| **ODB++** | `.tgz`, folder | `ODBParser` | Extract tarball → parse `bom/` directory files (structured text) → normalize. |
| **Generic CSV/Excel** | `.csv`, `.xlsx` | `CSVBOMParser` / `ExcelParser` | Smart header detection with keyword matching for 6 field groups. |

### 3.3 Parsing Pipeline

```
  ┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
  │ Upload  │───▶│ Detect    │───▶│ Route to  │───▶│ Normalize │───▶│ Return   │
  │ File    │    │ File Type │    │ Parser    │    │ to Model  │    │ JSON BOM │
  └─────────┘    └───────────┘    └───────────┘    └───────────┘    └──────────┘
                  Extension +      EagleParser      infer_category    Grouped by
                  Content sniff    KiCadParser       clean values     part_number
                                   GerberParser      deduplicate      + designators
                                   PDFParser         DNI flagging     + quantities
                                   ...
```

**File type detection** uses extension + content sniffing:
```python
def detect_file_type(filename):
    ext = filename.lower().split('.')[-1]
    if ext == 'kicad_sch': return 'kicad'
    if ext == 'sch':       return 'eagle'   # Default; content sniff for KiCad
    if ext == 'gbr':       return 'gerber'
    if ext == 'pdf':       return 'pdf'
    # ... etc
```

---

## 4. Data Model

### 4.1 Database Schema

```sql
-- Core component inventory
CREATE TABLE components (
    component_id   SERIAL PRIMARY KEY,
    component_name VARCHAR(255) NOT NULL,
    part_number    VARCHAR(100) UNIQUE NOT NULL,
    current_stock  INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    unit_price     NUMERIC(10,4) DEFAULT 0,
    description    TEXT,
    manufacturer   VARCHAR(200),
    footprint      VARCHAR(100),
    category       VARCHAR(100) DEFAULT 'Uncategorized',
    mounting_type  VARCHAR(10),    -- SMD / TH
    tolerance      VARCHAR(50),
    voltage_rating VARCHAR(50),
    min_threshold  INTEGER DEFAULT 0,
    location       VARCHAR(100),   -- Warehouse shelf
    supplier       VARCHAR(200),
    lead_time_days INTEGER DEFAULT 0,
    monthly_required_quantity INTEGER DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PCB types
CREATE TABLE pcb_types (
    pcb_id    SERIAL PRIMARY KEY,
    pcb_name  VARCHAR(200) NOT NULL,
    pcb_code  VARCHAR(50) UNIQUE,
    version   VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bill of Materials mapping
CREATE TABLE bom_mapping (
    bom_id           SERIAL PRIMARY KEY,
    pcb_id           INTEGER REFERENCES pcb_types(pcb_id),
    component_id     INTEGER REFERENCES components(component_id),
    quantity_per_unit INTEGER NOT NULL,
    designators      TEXT,          -- "R1, R2, R3"
    dni              BOOLEAN DEFAULT false,
    variant          VARCHAR(50) DEFAULT 'default'
);

-- Production entries with transaction safety
CREATE TABLE production_entries (
    entry_id          SERIAL PRIMARY KEY,
    pcb_id            INTEGER REFERENCES pcb_types(pcb_id),
    quantity_produced  INTEGER NOT NULL,
    produced_by        INTEGER REFERENCES users(user_id),
    notes              TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Immutable audit trail
CREATE TABLE component_transactions (
    transaction_id   SERIAL PRIMARY KEY,
    component_id     INTEGER REFERENCES components(component_id),
    entry_id         INTEGER REFERENCES production_entries(entry_id),
    transaction_type VARCHAR(20),  -- DEDUCTION, ADDITION, IMPORT, ADJUSTMENT
    quantity_changed INTEGER,
    balance_before   INTEGER,
    balance_after    INTEGER,
    reference_note   TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Procurement alerts
CREATE TABLE procurement_triggers (
    trigger_id       SERIAL PRIMARY KEY,
    component_id     INTEGER REFERENCES components(component_id),
    current_stock    INTEGER,
    threshold_quantity INTEGER,
    shortage_quantity  INTEGER,
    resolved         BOOLEAN DEFAULT false,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Intermediate BOM Data Model (In-Memory)

```typescript
interface BOMItem {
    designators: string;        // "R1, R2, R3"
    component_type: string;     // "Resistors"
    value: string;              // "10kΩ"
    footprint: string;          // "0603"
    mpn: string;                // "RC0603FR-0710KL"
    manufacturer: string;
    supplier: string;
    qty_per_pcb: number;        // 3
    build_qty_multiplier: number; // User input
    total_required: number;     // Calculated
    stock_available: number;    // From DB
    stock_after_build: number;  // Calculated
    reorder_flag: boolean;      // Calculated
    dni: boolean;
    variant: string;
    mounting_type: string;      // "SMD" | "TH"
    tolerance: string;
    voltage_rating: string;
    description: string;
}
```

---

## 5. Excel Formats

### 5.1 Standardized BOM Export

| Column | Source | Formula (if any) |
|---|---|---|
| Item No. | Auto-increment | `=ROW()-1` |
| Designators | Parser | — |
| Component Type | `infer_category()` | — |
| Value | Parser | — |
| Package / Footprint | Parser | — |
| MPN | Parser / User edit | — |
| Manufacturer | Parser | — |
| Supplier | Stock DB | — |
| Qty per PCB | Count of designators | — |
| Build Qty Multiplier | User input | — |
| **Total Required Qty** | Calculated | `=I2 * J2` (Qty per PCB × Multiplier) |
| Stock Available | DB query | — |
| **Stock After Build** | Calculated | `=L2 - K2` (Stock Available − Total Required) |
| **Reorder Flag** | Conditional | `=IF(M2<0, "YES", "NO")` |

**Excel generation** uses the `ExcelJS` library (Node.js) with:
- Conditional formatting: red background on negative `Stock After Build`
- Freeze panes on row 1 (headers)
- Auto-column widths
- Named sheet: "BOM"

### 5.2 Inventory / Stock Excel Template

| Column | Type | Description |
|---|---|---|
| MPN | Text | Primary match key |
| Component Name | Text | Human-readable |
| Category | Text | Auto-inferred or user-set |
| Package | Text | Footprint |
| Current Stock | Integer | Editable by user |
| Min Threshold | Integer | Reorder trigger point |
| Location | Text | Warehouse shelf/bin |
| Supplier | Text | Primary supplier |
| Lead Time (days) | Integer | Supplier delivery time |
| Unit Price | Decimal | Cost per unit |
| Last Updated | DateTime | Auto-set |

### 5.3 Shortage Report Excel

| Column | Description |
|---|---|
| MPN | Component identifier |
| Component Name | — |
| Required Qty | Total needed for build |
| Available Stock | Current inventory |
| Shortage Qty | `Required - Available` |
| Estimated Cost | `Shortage × Unit Price` |
| Supplier | Recommended supplier |
| Lead Time | Expected delivery time |

### 5.4 Procurement List Excel

| Column | Description |
|---|---|
| MPN | — |
| Component Name | — |
| Order Qty | Shortage + Safety buffer (20%) |
| Supplier | — |
| Unit Price | — |
| Total Cost | `Order Qty × Unit Price` |
| Priority | `HIGH` if lead time > 7 days |

---

## 6. Inventory Logic

### 6.1 Component Matching Algorithm

```
  ┌────────────────┐
  │ BOM Component  │
  │ from Parser    │
  └───────┬────────┘
          │
  ┌───────▼────────┐     Match?
  │ Match by MPN   │────────────▶ ✅ Linked
  │ (exact)        │     Yes
  └───────┬────────┘
          │ No
  ┌───────▼────────┐     Match?
  │ Match by MPN   │────────────▶ ✅ Linked
  │ (fuzzy/alias)  │     Yes
  └───────┬────────┘
          │ No
  ┌───────▼────────┐     Match?
  │ Match by Name  │────────────▶ ✅ Linked (needs user confirm)
  │ + Value + Pkg  │     Yes
  └───────┬────────┘
          │ No
  ┌───────▼────────┐
  │ Manual Mapping │────────────▶ User selects from DB or creates new
  │ (UI prompt)    │
  └────────────────┘
```

### 6.2 Stock Deduction Engine

```javascript
// Within a database transaction with SELECT FOR UPDATE
async function deductStock(bomItems, buildQty, client) {
    for (const item of bomItems) {
        const totalDeduct = item.qty_per_pcb * buildQty;
        
        // Lock row
        const row = await client.query(
            'SELECT current_stock FROM components WHERE component_id = $1 FOR UPDATE',
            [item.component_id]
        );
        
        // Deduct
        await client.query(
            'UPDATE components SET current_stock = current_stock - $1 WHERE component_id = $2',
            [totalDeduct, item.component_id]
        );
        
        // Audit log
        await client.query(
            'INSERT INTO component_transactions (...) VALUES (...)',
            [item.component_id, -totalDeduct, row.current_stock, row.current_stock - totalDeduct]
        );
    }
}
```

**Concurrency safety:** Uses PostgreSQL `SELECT FOR UPDATE` within `BEGIN/COMMIT` transactions. The `CHECK (current_stock >= 0)` constraint prevents negative stock even under race conditions.

---

## 7. Production Scaling

### 7.1 Core Formula

```
Total Required Qty = Qty per PCB × Build Qty Multiplier
Stock After Build  = Current Stock − Total Required Qty
Shortage           = max(0, Total Required Qty − Current Stock)
```

### 7.2 Advanced Scaling — Panelized PCBs

For panelized production where multiple PCBs share a single panel:

```
Effective Build Qty = ceil(PCB Count / PCBs per Panel) × PCBs per Panel
```

This accounts for partial-panel waste.

### 7.3 Variant Assembly Handling

When a PCB has multiple assembly variants (e.g., "WiFi version" vs "Bluetooth version"):

```sql
-- BOM items with variant filters
SELECT * FROM bom_mapping 
WHERE pcb_id = $1 
AND (variant = 'default' OR variant = $2)  -- $2 = selected variant
AND dni = false;                            -- Exclude DNI parts
```

The UI allows selecting a variant before production, filtering the BOM accordingly.

---

## 8. UX Flow

```
┌───────────────────────────────────────────────────────────────┐
│ STEP 1: UPLOAD                                                │
│ ┌─────────────────────────────────────────────────────┐       │
│ │  📁 Drag & drop or browse                           │       │
│ │  Supported: .sch .kicad_sch .gbr .pdf .csv ...      │       │
│ └─────────────────────────────────────────────────────┘       │
├───────────────────────────────────────────────────────────────┤
│ STEP 2: PARSING (auto-detected format)                        │
│ ┌─────────────────────────────────────────────────────┐       │
│ │  ████████████████████░░░░  78%  Parsing Eagle .sch  │       │
│ │  Found: 47 components, 12 unique types              │       │
│ └─────────────────────────────────────────────────────┘       │
├───────────────────────────────────────────────────────────────┤
│ STEP 3: BOM PREVIEW + CATEGORY EDIT                           │
│ ┌──────────┬────────┬───────┬─────────────────────────┐       │
│ │ Status   │ Part # │ Name  │ Category ▼              │       │
│ ├──────────┼────────┼───────┼─────────────────────────┤       │
│ │ ✅ NEW   │ RC0603 │ 10kΩ  │ [Resistors        ▼]   │       │
│ │ ✅ NEW   │ CC0402 │ 100nF │ [Capacitors       ▼]   │       │
│ │ ⚠️ NEW   │ U-CUST │ IC    │ [Uncategorized    ▼]   │ ← amber│
│ │ 🔵 EXISTS│ LM7805 │ Vreg  │ [Voltage Regulators▼]  │       │
│ └──────────┴────────┴───────┴─────────────────────────┘       │
│  ⚠️ 1 component uncategorized. Assign before confirming.      │
│                                         Total: 47  New: 12    │
├───────────────────────────────────────────────────────────────┤
│ STEP 4: PRODUCTION QUANTITY                                    │
│ ┌─────────────────────────────────────────────────────┐       │
│ │  PCBs to manufacture: [___100___]                    │       │
│ │  Variant: [Default ▼]   Panel size: [1 ▼]           │       │
│ └─────────────────────────────────────────────────────┘       │
├───────────────────────────────────────────────────────────────┤
│ STEP 5: INVENTORY IMPACT PREVIEW                              │
│ ┌────────┬──────┬──────┬───────┬──────────────────────┐       │
│ │ Part # │ Need │ Have │ After │ Status               │       │
│ ├────────┼──────┼──────┼───────┼──────────────────────┤       │
│ │ RC0603 │ 300  │ 500  │ 200   │ ✅ OK                │       │
│ │ CC0402 │ 200  │ 50   │ -150  │ 🔴 SHORTAGE (-150)   │       │
│ └────────┴──────┴──────┴───────┴──────────────────────┘       │
├───────────────────────────────────────────────────────────────┤
│ STEP 6: CONFIRM & EXPORT                                      │
│ ┌─────────────────────────────────────────────────────┐       │
│ │  [📥 Export BOM Excel]  [📥 Shortage Report]         │       │
│ │  [✅ Confirm & Deduct Stock]  [Cancel]               │       │
│ └─────────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. Ecosystem Integration

### 9.1 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/components/import-schematic` | Upload & parse schematic → preview | Engineer+ |
| `POST` | `/api/components/batch-upsert` | Confirm import → create/update components | Engineer+ |
| `GET`  | `/api/components` | List all components with filters | Any |
| `GET`  | `/api/components/categories` | List distinct categories | Any |
| `PUT`  | `/api/components/:id` | Update single component | Inventory Mgr+ |
| `GET`  | `/api/components/export` | Export inventory to Excel | Any |
| `POST` | `/api/production/entry` | Create production entry (deduct stock) | Engineer+ |
| `GET`  | `/api/pcb-types/:id/bom` | Get BOM for a PCB type | Any |
| `GET`  | `/api/procurement/alerts` | Active shortage alerts | Inventory Mgr+ |
| `POST` | `/api/bom/export-excel` | Generate standardized BOM Excel | Any |
| `POST` | `/api/reports/shortage` | Generate shortage report | Inventory Mgr+ |

### 9.2 Event Triggers

| Event | Trigger | Actions |
|---|---|---|
| `schematic.imported` | File parsed successfully | Notify inventory managers of new components |
| `production.created` | Production entry confirmed | Deduct stock, check thresholds, log transactions |
| `stock.below_threshold` | Stock < 20% of monthly requirement | Create procurement trigger, email alert |
| `stock.negative_blocked` | CHECK constraint hit | Return 400 with concurrency note |
| `component.obsolete` | Lifecycle check (scheduled) | Flag component, suggest alternatives |

### 9.3 User Permissions

| Role | Capabilities |
|---|---|
| **Viewer** | View inventory, BOM, reports |
| **Engineer** | Upload schematics, create production entries, edit BOM |
| **Inventory Manager** | Edit stock levels, resolve procurement alerts, manage suppliers |
| **Admin** | All above + user management, system config |

---

## 10. Automation & AI Features

### 10.1 Implemented (Current)

| Feature | Implementation |
|---|---|
| **Smart Categorization** | 4-layer `infer_category()` — value regex, keyword, part-number prefix, ref designator |
| **Auto-detection** | `detect_file_type()` routes files to correct parser |
| **Procurement alerts** | Auto-triggered when stock falls below 20% threshold |
| **Concurrent transaction safety** | `SELECT FOR UPDATE` + `CHECK` constraints |

### 10.2 Planned Enhancements

| Feature | Technology | Description |
|---|---|---|
| **PDF OCR** | Tesseract / Google Vision AI | Extract BOM tables from scanned PDFs |
| **Symbol Recognition AI** | TensorFlow / YOLO | Identify component symbols in schematic images |
| **Auto-MPN Lookup** | Octopart API / Mouser API | Look up MPN from value + footprint + description |
| **Supplier Price Scraping** | DigiKey/Mouser APIs | Real-time pricing for cost estimation |
| **Alternate Part Suggestions** | Octopart cross-reference | When a part is out of stock, suggest compatible alternates |
| **Lifecycle Alerts** | IHS Markit / Octopart | Flag EOL (End of Life) or NRND (Not Recommended for New Design) parts |
| **Fuzzy MPN Matching** | Levenshtein distance | Match `RC0603FR-0710KL` to `RC0603FR0710KL` (no dash) |

### 10.3 OCR Pipeline for Scanned PDFs

```
Scanned PDF → Page images → Tesseract OCR → Raw text
    → Table detection (OpenCV) → Structured rows
    → Column mapping (keyword matching)
    → Normalized BOM JSON
```

---

## 11. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React + Vite | Fast dev cycle, component reuse |
| **Backend API** | Node.js + Express | Matches existing codebase |
| **Parsing Engine** | Python (subprocess) | Rich ecosystem: `pdfplumber`, `xml.etree`, `openpyxl` |
| **OCR** | Tesseract (via `pytesseract`) | Open-source, good accuracy |
| **Database** | PostgreSQL | ACID compliance, `FOR UPDATE` locking, CHECK constraints |
| **Excel Generation** | ExcelJS (Node) / OpenPyXL (Python) | Mature libraries with formula support |
| **File Upload** | Multer (Node.js middleware) | Battle-tested, configurable |
| **Authentication** | JWT (jsonwebtoken) | Stateless, role-based |
| **Connection Pool** | `pg` Pool (max: 20) | Concurrent request handling |

---

## 12. Edge Case Handling

| Edge Case | Handling Strategy |
|---|---|
| **Missing MPNs** | Use value + footprint as composite key. Flag for manual mapping in preview. |
| **Custom / house parts** | Allow user to create new component entry with custom part number during preview. |
| **Obsolete parts** | Lifecycle check integration (planned). Currently: manual flagging. |
| **Mixed unit systems** | Normalize in parser: `10kohm` → `10kΩ`, `100nf` → `100nF`, `4u7` → `4.7µF`. |
| **Variant builds** | BOM entries tagged with `variant` field. UI filter before production. |
| **Panelized PCBs** | Multiplier accounts for panel factor: `Effective Qty = PCBs × Panel Factor`. |
| **DNI (Do Not Install)** | Parser flags DNI components. Excluded from stock deduction but shown in BOM. |
| **Duplicate parts** | Grouped by `(value, footprint, part_number)` tuple. Designators aggregated. |
| **Multi-unit components** | Count each unit as separate designator. Qty reflects actual units needed. |
| **Concurrent production** | Row-level DB locking (`SELECT FOR UPDATE`), `CHECK (current_stock >= 0)`, transaction rollback. |
| **Negative stock prevention** | PostgreSQL constraint + application-level pre-flight check + frontend button disabling. |
| **Large files (>10MB)** | Multer file size limit. Streaming parser for very large Gerber files. |
| **Unsupported formats** | Clear error message with list of supported formats. |

---

## 13. Implementation Roadmap

### Phase 1: Core (✅ Implemented)
- [x] File upload + Python parser subprocess
- [x] Eagle, KiCad, Altium, EasyEDA, PDF parsers
- [x] Smart 4-layer categorization engine
- [x] BOM preview with editable categories
- [x] Component inventory CRUD
- [x] Production entry with stock deduction
- [x] Transaction safety (SELECT FOR UPDATE)
- [x] Excel import/export
- [x] Gerber file support

### Phase 2: Enhanced Matching & Formats (Next)
- [ ] IPC-2581 parser
- [ ] ODB++ parser
- [ ] OrCAD netlist parser
- [ ] Fuzzy MPN matching algorithm
- [ ] Manual mapping UI for unmatched components
- [ ] DNI and variant assembly support
- [ ] Panelized PCB multiplier

### Phase 3: Intelligence Layer
- [ ] Tesseract OCR for scanned PDFs
- [ ] Auto-MPN lookup via Octopart API
- [ ] Supplier price integration (DigiKey/Mouser API)
- [ ] Alternate part suggestions
- [ ] Lifecycle/obsolescence alerts
- [ ] Cost estimation report

### Phase 4: Enterprise Scale
- [ ] Role-based access control (Viewer/Engineer/Inventory Mgr/Admin)
- [ ] Event-driven notifications (email/Slack)
- [ ] Audit log dashboard
- [ ] Multi-warehouse location support
- [ ] ERP/MES API integration
- [ ] Batch production scheduling
- [ ] Extract parsing service into standalone microservice

---

## Appendix: Example Workflows

### Workflow A: First-Time Schematic Import

1. User clicks **"Import Schematic"** → selects `.kicad_sch` file
2. System detects KiCad format → spawns `parse_pcb.py`
3. Parser extracts 47 components → `infer_category()` classifies 44, leaves 3 as Uncategorized
4. Preview modal shows all 47 with editable category dropdowns
5. User fixes 3 uncategorized → clicks **"Confirm Import"**
6. Backend `batchUpsertComponents` creates 47 component records in DB

### Workflow B: Production Run

1. User selects PCB type → enters quantity: 100
2. System loads BOM → locks component rows (`FOR UPDATE`)
3. Pre-flight check: 2 components have insufficient stock
4. Error: structured shortage table with exact deficits
5. User reduces quantity to 50 → BOM auto-refreshes
6. All components have sufficient stock → **"Confirm"**
7. System deducts stock, logs transactions, checks procurement thresholds
8. 1 component falls below 20% → procurement alert triggered

### Workflow C: Excel Export for Procurement

1. User clicks **"Export BOM Excel"** from production preview
2. System generates `.xlsx` with formulas: `Total Required`, `Stock After Build`, `Reorder Flag`
3. User sends Excel to procurement team
4. Procurement team edits supplier/pricing columns offline
5. User re-imports updated Excel → stock DB updated
