# PCB Component Parser System

A web application that parses PCB schematics from multiple CAD tools (KiCad, Eagle, Altium, EasyEDA) and extracts component information to generate Bills of Materials (BOM).

## Features

✅ **Multi-Format Support**
- KiCad (.kicad_sch)
- Eagle (.sch)
- Altium (.SchDoc)
- EasyEDA (.json)

✅ **Interactive Dashboard**
- Drag & drop file upload
- Real-time component extraction
- Beautiful, responsive UI
- Summary statistics

✅ **Export Options**
- CSV format
- Excel (.xlsx) format
- Grouped BOM with quantities
- Detailed component list

## Architecture

```
Frontend (React)           Backend (Flask)              Parsers
    |                           |                          |
    ├─ Upload UI               ├─ /api/upload            ├─ KiCadParser
    ├─ Dashboard               ├─ /api/download          ├─ EagleParser
    └─ BOM Display             └─ File Processing        ├─ AltiumParser
                                                          └─ EasyEDAParser
```

## Installation

### Prerequisites
- Python 3.8+
- pip

### Setup

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Start the backend server:**
```bash
python app.py
```

The backend will run on `http://localhost:5000`

3. **Open the frontend:**
```bash
# Simply open index.html in your browser
# Or use a local server:
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Usage

1. **Upload a file:**
   - Drag and drop your PCB schematic file
   - Or click "Browse Files" to select

2. **Parse components:**
   - Click "Parse Components"
   - Wait for the analysis to complete

3. **View results:**
   - See summary statistics
   - Browse the BOM table
   - View all component details

4. **Export data:**
   - Download CSV for spreadsheet import
   - Download Excel for formatted reports

## Supported File Formats

### KiCad (.kicad_sch)
- KiCad 6.0+ S-expression format
- Extracts: Reference, Value, Footprint, Part Number
- Supports custom properties

### Eagle (.sch)
- Eagle XML schematic format
- Extracts: Part name, Device, Value, Attributes
- Supports manufacturer info

### Altium (.SchDoc)
- Altium binary format (simplified parser)
- Extracts: Designator, Comment
- Note: Full binary parsing requires additional libraries

### EasyEDA (.json)
- EasyEDA JSON format
- Extracts: All component attributes
- Supports supplier information

## API Endpoints

### POST /api/upload
Upload and parse a PCB schematic file.

**Request:**
- Content-Type: multipart/form-data
- Body: file (schematic file)

**Response:**
```json
{
  "success": true,
  "file_type": "kicad",
  "components": [...],
  "bom": [...],
  "csv_file": "filename_bom.csv",
  "excel_file": "filename_bom.xlsx",
  "total_components": 45,
  "unique_parts": 23
}
```

### GET /api/download/<filename>
Download generated BOM files.

**Response:**
- File download (CSV or Excel)

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Output Format

### BOM Structure
```csv
Designators,Quantity,Value,Footprint,Part Number,Description
"R1, R2, R3",3,"10k","0805","RC0805FR-0710KL","Resistor 10k 0805"
"C1, C2",2,"100nF","0603","GRM188R71C104KA01D","Capacitor 100nF 0603"
```

### Component Details
Each component includes:
- **Reference**: Component designator (R1, C2, U3, etc.)
- **Value**: Component value or part type
- **Footprint**: PCB footprint name
- **Part Number**: Manufacturer part number
- **Description**: Component description

## Extending the Parser

### Adding a New CAD Format

1. **Create a new parser class:**

```python
class MyCADParser(ComponentParser):
    def parse(self):
        # Your parsing logic here
        with open(self.filepath, 'r') as f:
            # Parse the file
            pass
        
        # Populate self.components
        self.components = [
            {
                'reference': 'R1',
                'value': '10k',
                'footprint': '0805',
                'part_number': 'ABC123',
                'description': 'Resistor'
            }
        ]
        return True
```

2. **Register the parser:**

```python
def get_parser(file_type, filepath):
    parsers = {
        'kicad': KiCadParser,
        'eagle': EagleParser,
        'altium': AltiumParser,
        'easyeda': EasyEDAParser,
        'mycad': MyCADParser  # Add your parser
    }
    # ...
```

3. **Update file type detection:**

```python
def detect_file_type(filename):
    ext = filename.lower().split('.')[-1]
    
    if ext == 'mycad':
        return 'mycad'
    # ...
```

## Advanced Features (Future Enhancements)

- **Component Search**: Search for specific components
- **Supplier Integration**: Check Digi-Key/Mouser pricing and stock
- **Cost Estimation**: Calculate total BOM cost
- **Duplicate Detection**: Find similar components
- **Project Management**: Save and compare multiple designs
- **API Access**: RESTful API for automation
- **Batch Processing**: Process multiple files at once
- **Version Control**: Track BOM changes over time

## Troubleshooting

### Backend won't start
```bash
# Make sure all dependencies are installed
pip install -r requirements.txt

# Check if port 5000 is available
lsof -i :5000
```

### File parsing fails
- Ensure the file format is supported
- Check file is not corrupted
- For Altium files, consider using a full binary parser library

### CORS errors
- Make sure Flask-CORS is installed
- Check that the backend URL in index.html matches your setup

## Development

### Project Structure
```
pcb-parser-system/
├── app.py              # Flask backend server
├── index.html          # React frontend dashboard
├── requirements.txt    # Python dependencies
├── uploads/           # Uploaded files (created on first run)
└── outputs/           # Generated BOM files (created on first run)
```

### Running in Production

For production deployment, consider:
- Using Gunicorn or uWSGI for the Flask app
- Serving the frontend through Nginx
- Adding authentication/authorization
- Implementing rate limiting
- Using a proper database for caching results

## License

MIT License - Feel free to use and modify for your projects!

## Contributing

Contributions welcome! Areas for improvement:
- Enhanced Altium parser using proper binary parsing
- Support for additional CAD formats
- Component database integration
- Advanced BOM analysis features

## Support

For issues or questions, please open an issue on GitHub or contact the maintainer.
