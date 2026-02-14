# System Architecture

## Overview

The PCB Component Parser is a full-stack web application that extracts component information from various PCB CAD file formats and generates Bills of Materials (BOMs).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │         Frontend (React + Tailwind CSS)           │     │
│  │                                                    │     │
│  │  • File Upload UI (Drag & Drop)                  │     │
│  │  • Interactive Dashboard                         │     │
│  │  • BOM Table Display                            │     │
│  │  • Export Controls                              │     │
│  └───────────────────────────────────────────────────┘     │
│                          │                                  │
│                          │ HTTP/REST API                   │
│                          ▼                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server (Flask)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  API Layer   │  │ File Handler │  │ BOM Generator│     │
│  │              │  │              │  │              │     │
│  │ • /upload    │  │ • Validation │  │ • Grouping   │     │
│  │ • /download  │  │ • Storage    │  │ • Counting   │     │
│  │ • /health    │  │ • Type Detect│  │ • Formatting │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │           Parser Engine (Strategy Pattern)      │       │
│  │                                                  │       │
│  │  ┌─────────────┐  ┌─────────────┐              │       │
│  │  │ KiCadParser │  │ EagleParser │              │       │
│  │  └─────────────┘  └─────────────┘              │       │
│  │                                                  │       │
│  │  ┌─────────────┐  ┌──────────────┐             │       │
│  │  │AltiumParser │  │EasyEDAParser │             │       │
│  │  └─────────────┘  └──────────────┘             │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │            Export Engine                        │       │
│  │                                                  │       │
│  │  • CSV Generator (pandas)                      │       │
│  │  • Excel Generator (openpyxl)                  │       │
│  │  • JSON Formatter                              │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System Storage                      │
├─────────────────────────────────────────────────────────────┤
│  • uploads/ (temporary uploaded files)                     │
│  • outputs/ (generated BOM files)                          │
└─────────────────────────────────────────────────────────────┘
```

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ AJAX Requests
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         API Gateway                          │
│                      (Flask Routes)                          │
└──────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
         ┌────────────┐ ┌────────┐ ┌──────────┐
         │File Manager│ │ Parser │ │Exporter  │
         └────────────┘ └────────┘ └──────────┘
                 │            │            │
                 └────────────┼────────────┘
                              ▼
                    ┌───────────────────┐
                    │  Data Processing  │
                    │                   │
                    │ • Validation      │
                    │ • Transformation  │
                    │ • Aggregation     │
                    └───────────────────┘
```

## Data Flow

```
User Action          →  API Call           →  Processing         →  Response
─────────────────────────────────────────────────────────────────────────────

1. Upload File       →  POST /api/upload   →  Save to /uploads   →  File ID
                                            →  Detect file type

2. Parse File        →  (automatic)        →  Select parser      →  Components[]
                                            →  Extract data
                                            →  Validate structure

3. Generate BOM      →  (automatic)        →  Group components   →  BOM[]
                                            →  Count quantities
                                            →  Format output

4. Export Data       →  GET /api/download  →  Generate CSV/Excel →  File Download
                                            →  Save to /outputs
```

## File Format Support Matrix

```
┌──────────────┬──────────┬───────────┬──────────────┬─────────────┐
│ Format       │ Extension│ Parser    │ Complexity   │ Accuracy    │
├──────────────┼──────────┼───────────┼──────────────┼─────────────┤
│ KiCad        │ .kicad_sch│ S-expr   │ Medium       │ High (95%)  │
│ Eagle        │ .sch     │ XML       │ Low          │ High (98%)  │
│ Altium       │ .SchDoc  │ Binary    │ High         │ Medium (70%)│
│ EasyEDA      │ .json    │ JSON      │ Low          │ High (95%)  │
└──────────────┴──────────┴───────────┴──────────────┴─────────────┘
```

## Class Hierarchy

```
ComponentParser (Abstract Base Class)
│
├── KiCadParser
│   ├── parse()
│   ├── _parse_sexpr()
│   └── get_bom()
│
├── EagleParser
│   ├── parse()
│   ├── _parse_xml()
│   └── get_bom()
│
├── AltiumParser
│   ├── parse()
│   ├── _parse_binary()
│   └── get_bom()
│
└── EasyEDAParser
    ├── parse()
    ├── _parse_json()
    └── get_bom()
```

## API Specification

### Endpoints

```
┌────────────────────────────────────────────────────────────────┐
│ Method │ Endpoint         │ Description                        │
├────────┼──────────────────┼────────────────────────────────────┤
│ POST   │ /api/upload      │ Upload and parse schematic file    │
│ GET    │ /api/download/:id│ Download generated BOM file        │
│ GET    │ /api/health      │ Health check endpoint              │
└────────────────────────────────────────────────────────────────┘
```

### Request/Response Flow

**Upload Request:**
```
POST /api/upload
Content-Type: multipart/form-data

{
  file: <binary data>
}
```

**Upload Response:**
```json
{
  "success": true,
  "file_type": "kicad",
  "components": [
    {
      "reference": "R1",
      "value": "10k",
      "footprint": "0805",
      "part_number": "RC0805FR-0710KL",
      "description": "Resistor 10k 0805"
    }
  ],
  "bom": [
    {
      "designators": "R1, R2, R3",
      "quantity": 3,
      "value": "10k",
      "footprint": "0805",
      "part_number": "RC0805FR-0710KL",
      "description": "Resistor 10k 0805"
    }
  ],
  "csv_file": "filename_bom.csv",
  "excel_file": "filename_bom.xlsx",
  "total_components": 45,
  "unique_parts": 23
}
```

## Security Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Security Layers                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Input Validation                                  │
│     ├── File type verification                        │
│     ├── File size limits (16MB)                       │
│     └── Filename sanitization                         │
│                                                        │
│  2. CORS Protection                                   │
│     └── Allowed origins configuration                 │
│                                                        │
│  3. Rate Limiting (Optional)                          │
│     ├── Per-IP limits                                 │
│     └── Per-endpoint limits                           │
│                                                        │
│  4. Authentication (Optional)                         │
│     ├── API keys                                      │
│     └── OAuth 2.0                                     │
│                                                        │
│  5. File System Security                              │
│     ├── Isolated upload directory                     │
│     ├── Temporary file cleanup                        │
│     └── No code execution from uploads                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Bottlenecks & Solutions

```
┌─────────────────────┬──────────────────┬────────────────────┐
│ Bottleneck          │ Impact           │ Solution           │
├─────────────────────┼──────────────────┼────────────────────┤
│ Large file parsing  │ Slow response    │ Stream processing  │
│ Memory usage        │ Server crashes   │ Chunk reading      │
│ Concurrent uploads  │ Queue buildup    │ Async processing   │
│ Repeated parsing    │ Wasted CPU       │ Caching layer      │
└─────────────────────┴──────────────────┴────────────────────┘
```

### Optimization Strategies

1. **File Processing**
   - Stream large files instead of loading into memory
   - Use generator functions for parsing
   - Implement timeout mechanisms

2. **Caching**
   - Cache parsed results by file hash
   - Store frequently accessed BOMs
   - Use Redis for distributed caching

3. **Async Processing**
   - Use Celery for background tasks
   - Queue large files for batch processing
   - Implement progress tracking

## Technology Stack

```
Frontend
├── React 18 (UI library)
├── Tailwind CSS (styling)
└── Fetch API (HTTP client)

Backend
├── Flask (web framework)
├── Flask-CORS (CORS handling)
├── Pandas (data processing)
├── openpyxl (Excel generation)
└── xml.etree (XML parsing)

Infrastructure
├── Python 3.8+ (runtime)
├── pip (package manager)
└── File system (storage)

Optional
├── Gunicorn (production server)
├── nginx (reverse proxy)
├── Redis (caching)
├── Celery (background jobs)
└── PostgreSQL (database)
```

## Scalability Considerations

### Horizontal Scaling
```
         ┌──────────────┐
         │ Load Balancer│
         └───────┬──────┘
                 │
        ┌────────┼────────┐
        │        │        │
    ┌───▼───┐┌───▼───┐┌───▼───┐
    │App 1  ││App 2  ││App 3  │
    └───┬───┘└───┬───┘└───┬───┘
        │        │        │
        └────────┼────────┘
                 │
         ┌───────▼────────┐
         │ Shared Storage │
         │ (S3/NFS)       │
         └────────────────┘
```

### Vertical Scaling
- Increase server CPU/RAM
- Use faster storage (SSD)
- Optimize parsing algorithms
- Implement parallel processing

## Error Handling

```
┌────────────────────────────────────────────────────────┐
│                    Error Types                         │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Client Errors (4xx)                               │
│     ├── 400: Invalid file format                      │
│     ├── 413: File too large                           │
│     └── 415: Unsupported file type                    │
│                                                        │
│  2. Server Errors (5xx)                               │
│     ├── 500: Parsing failed                           │
│     ├── 503: Service unavailable                      │
│     └── 507: Insufficient storage                     │
│                                                        │
│  3. Application Errors                                │
│     ├── Malformed file structure                      │
│     ├── Missing required fields                       │
│     └── Encoding issues                               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Future Enhancements

1. **Advanced Parsing**
   - Support for more CAD formats (OrCAD, PADS)
   - OCR for hand-drawn schematics
   - Multi-sheet schematic handling

2. **Integration**
   - Supplier API integration (Digi-Key, Mouser)
   - PLM system integration
   - Version control (Git) integration

3. **Analytics**
   - Component usage statistics
   - Cost analysis
   - Availability tracking

4. **Collaboration**
   - Multi-user support
   - Comments and annotations
   - Change tracking

5. **AI Features**
   - Component recommendation
   - Duplicate detection
   - Alternative part suggestions
