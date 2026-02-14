---
description: Workflow for integrating PCB CAD file import during development phase
---

# PCB CAD Import Integration Workflow

This workflow describes how to integrate the existing PCB Parser skill into the inventory management application during the development phase.

## Overview

The PCB Parser skill (`antigravity_skills/antigravity_skills_scripts/app.py`) is already implemented and supports:
- **KiCad** (`.kicad_sch`)
- **Eagle** (`.sch`)
- **Altium** (`.SchDoc`)
- **EasyEDA** (`.json`)
- **PDF BOMs** (`.pdf`)

## Integration Points

### Backend Integration

**Endpoint**: `POST /api/pcb/import-cad`

**Implementation Steps**:

1. **Set up Multer for file upload** (already configured for Excel):
   ```javascript
   const upload = multer({ dest: 'uploads/' });
   ```

2. **Create `pcbController.js` endpoint**:
   ```javascript
   const { exec } = require('child_process');
   const path = require('path');

   exports.importCAD = async (req, res) => {
     if (!req.file) {
       return res.status(400).json({ error: 'No file uploaded' });
     }

     const filePath = req.file.path;
     const scriptPath = path.join(__dirname, '../../.agent/skills/pcb_parser/parse_bom.py');

     exec(`python ${scriptPath} ${filePath}`, (error, stdout, stderr) => {
       if (error) {
         return res.status(500).json({ error: 'Parsing failed', details: stderr });
       }

       try {
         const parsedData = JSON.parse(stdout);
         // parsedData contains: { success, filename, type, total_components, unique_parts, bom, components }
         res.json(parsedData);
       } catch (e) {
         res.status(500).json({ error: 'Invalid parser output' });
       }
     });
   };
   ```

3. **Add route** in `pcbRoutes.js`:
   ```javascript
   router.post('/import-cad', upload.single('file'), pcbController.importCAD);
   ```

### Frontend Integration

**Component**: `src/components/pcb/CADImporter.jsx`

**Implementation**:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const CADImporter = ({ onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post('/api/pcb/import-cad', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { bom, components } = response.data;
      onImportSuccess({ bom, components });
      alert(`Imported ${response.data.unique_parts} unique components`);
    } catch (error) {
      alert('Import failed: ' + error.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cad-importer">
      <input type="file" accept=".kicad_sch,.sch,.SchDoc,.json,.pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Parsing...' : 'Import CAD File'}
      </button>
      <p className="help-text">
        Supported: KiCad, Eagle, Altium, EasyEDA, PDF
      </p>
    </div>
  );
};

export default CADImporter;
```

### BOM Builder Integration

**Add CAD import button** to `BOMBuilder.jsx`:

```jsx
import CADImporter from './CADImporter';

const BOMBuilder = () => {
  const [bomComponents, setBomComponents] = useState([]);

  const handleCADImportSuccess = ({ bom }) => {
    // Auto-populate BOM with parsed components
    setBomComponents(bom);
  };

  return (
    <div>
      <h3>BOM Builder</h3>
      
      {/* Manual Entry */}
      <ComponentSelector onChange={addComponent} />
      
      {/* OR Import from CAD */}
      <div className="import-section">
        <h4>Import from CAD File</h4>
        <CADImporter onImportSuccess={handleCADImportSuccess} />
      </div>

      {/* Display BOM */}
      <BOMTable components={bomComponents} />
    </div>
  );
};
```

## Trigger Points During Development

### Phase 3: Architect (Backend)
1. **After** implementing `pcbController.js` for manual PCB creation
2. **Add** CAD import endpoint (`POST /api/pcb/import-cad`)
3. **Test** with sample files from `antigravity_skills/antigravity_skills_scripts/` (sample_kicad.kicad_sch, sample_eagle.sch)

### Phase 3: Architect (Frontend)
1. **After** implementing `BOMBuilder.jsx` for manual mapping
2. **Add** `CADImporter.jsx` component
3. **Integrate** into BOM Builder as alternative input method

### Phase 4: Stylize
1. **Polish** file upload UI (drag & drop)
2. **Add** parsing progress indicator
3. **Display** import preview before saving

## Testing Workflow

1. **Unit Test**: Test parser with sample files
   ```bash
   python .agent/skills/pcb_parser/parse_bom.py antigravity_skills/antigravity_skills_scripts/sample_kicad.kicad_sch
   ```

2. **Integration Test**: Test backend endpoint with Postman/curl
   ```bash
   curl -X POST -F "file=@sample_kicad.kicad_sch" http://localhost:5000/api/pcb/import-cad
   ```

3. **E2E Test**: Upload CAD file via frontend, verify BOM auto-population

## Dependencies

**Python** (for parser):
```bash
pip install pdfplumber pandas openpyxl flask
```

**Backend** (already in package.json):
- `multer` (file upload)
- `child_process` (Node.js built-in)

## Implementation Timeline

- **Checkpoint 3.4.1**: PCB CRUD with manual BOM (REQUIRED)
- **Checkpoint 3.4.2**: CAD Import Integration (OPTIONAL - if time permits)
- **Total Estimated Time**: 2-3 hours

## Notes

- CAD import is a **productivity feature**, not a core requirement
- Implement **after** manual BOM builder is working
- If time is limited, defer to post-MVP enhancement
- Parser is **already tested** and production-ready (see `antigravity_skills/antigravity_skills_scripts/PROJECT_SUMMARY.md`)
