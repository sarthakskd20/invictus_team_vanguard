from flask import Flask, request, jsonify, send_file, send_from_directory
import pdfplumber
from flask_cors import CORS
import os
import json
import xml.etree.ElementTree as ET
import zipfile
import io
import pandas as pd
from werkzeug.utils import secure_filename
import re

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)


@app.route('/')
def serve_frontend():
    """Serve the frontend HTML"""
    return send_from_directory('.', 'index.html')

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

class ComponentParser:
    """Base class for PCB component parsers"""
    
    def __init__(self, filepath):
        self.filepath = filepath
        self.components = []
    
    def parse(self):
        raise NotImplementedError
    
    def get_bom(self):
        """Generate Bill of Materials"""
        bom = {}
        for comp in self.components:
            key = (comp.get('value', ''), comp.get('footprint', ''), comp.get('part_number', ''))
            if key not in bom:
                bom[key] = {
                    'designators': [],
                    'value': comp.get('value', 'N/A'),
                    'footprint': comp.get('footprint', 'N/A'),
                    'part_number': comp.get('part_number', 'N/A'),
                    'description': comp.get('description', 'N/A'),
                    'quantity': 0
                }
            bom[key]['designators'].append(comp.get('reference', ''))
            bom[key]['quantity'] += 1
        
        # Convert to list format
        bom_list = []
        for item in bom.values():
            item['designators'] = ', '.join(sorted(item['designators']))
            bom_list.append(item)
        
        return sorted(bom_list, key=lambda x: x['designators'])


class KiCadParser(ComponentParser):
    """Parser for KiCad schematic files (.kicad_sch)"""
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # KiCad 6+ uses S-expression format
            self.components = self._parse_sexpr(content)
            return True
        except Exception as e:
            print(f"KiCad parse error: {e}")
            return False
    
    def _parse_sexpr(self, content):
        """Parse KiCad S-expression format"""
        components = []
        
        # Simple regex-based parsing for symbols
        symbol_pattern = r'\(symbol\s+\(lib_id\s+"([^"]+)"\)\s+\(at\s+[\d.\s]+\)\s+.*?\(property\s+"Reference"\s+"([^"]+)".*?\(property\s+"Value"\s+"([^"]+)"'
        
        matches = re.finditer(symbol_pattern, content, re.DOTALL)
        
        for match in matches:
            lib_id = match.group(1)
            reference = match.group(2)
            value = match.group(3)
            
            # Extract footprint if present
            footprint_match = re.search(r'\(property\s+"Footprint"\s+"([^"]+)"', match.group(0))
            footprint = footprint_match.group(1) if footprint_match else ''
            
            # Extract part number if present
            pn_match = re.search(r'\(property\s+"PartNumber"\s+"([^"]+)"', match.group(0))
            part_number = pn_match.group(1) if pn_match else ''
            
            components.append({
                'reference': reference,
                'value': value,
                'footprint': footprint,
                'part_number': part_number,
                'library': lib_id,
                'description': f'{lib_id} - {value}'
            })
        
        return components


class EagleParser(ComponentParser):
    """Parser for Eagle schematic files (.sch)"""
    
    def parse(self):
        try:
            tree = ET.parse(self.filepath)
            root = tree.getroot()
            
            # Eagle uses XML format
            for part in root.findall('.//parts/part'):
                reference = part.get('name', '')
                deviceset = part.get('deviceset', '')
                device = part.get('device', '')
                value = part.get('value', deviceset)
                
                # Try to find attributes
                attributes = {}
                for attr in part.findall('.//attribute'):
                    attr_name = attr.get('name', '')
                    attr_value = attr.get('value', '')
                    attributes[attr_name] = attr_value
                
                self.components.append({
                    'reference': reference,
                    'value': value,
                    'footprint': device,
                    'part_number': attributes.get('PARTNUMBER', attributes.get('MPN', '')),
                    'description': f'{deviceset}{device}',
                    'manufacturer': attributes.get('MANUFACTURER', '')
                })
            
            return True
        except Exception as e:
            print(f"Eagle parse error: {e}")
            return False


class AltiumParser(ComponentParser):
    """Parser for Altium schematic files (.SchDoc)"""
    
    def parse(self):
        try:
            # Altium files are binary, this is a simplified parser
            # In production, you'd use a library like altium-py or parse the binary format
            with open(self.filepath, 'rb') as f:
                content = f.read()
            
            # Extract text strings (simplified approach)
            text_content = content.decode('utf-8', errors='ignore')
            
            # Look for component patterns (this is simplified)
            # Real implementation would need proper binary parsing
            comp_pattern = r'Designator=([^\x00]+)\x00.*?Comment=([^\x00]+)'
            matches = re.finditer(comp_pattern, text_content, re.DOTALL)
            
            for match in matches:
                reference = match.group(1).strip()
                value = match.group(2).strip()
                
                self.components.append({
                    'reference': reference,
                    'value': value,
                    'footprint': '',
                    'part_number': '',
                    'description': value
                })
            
            return True
        except Exception as e:
            print(f"Altium parse error: {e}")
            return False


class EasyEDAParser(ComponentParser):
    """Parser for EasyEDA JSON files"""
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # EasyEDA stores components in different formats
            if isinstance(data, dict):
                shapes = data.get('shape', [])
            elif isinstance(data, list):
                shapes = data
            else:
                return False
            
            for shape in shapes:
                if isinstance(shape, dict) and shape.get('gge') == 'LIB':
                    # This is a component
                    attrs = shape.get('attrs', {})
                    
                    self.components.append({
                        'reference': attrs.get('Designator', ''),
                        'value': attrs.get('Value', ''),
                        'footprint': attrs.get('Footprint', ''),
                        'part_number': attrs.get('Supplier Part', ''),
                        'description': attrs.get('Description', ''),
                        'manufacturer': attrs.get('Manufacturer', '')
                    })
            
            return True
        except Exception as e:
            print(f"EasyEDA parse error: {e}")
            return False


class PDFParser(ComponentParser):
    """Parser for PDF files containing BOM/component tables"""
    
    def parse(self):
        try:
            with pdfplumber.open(self.filepath) as pdf:
                all_text = ''
                tables_found = []
                
                for page in pdf.pages:
                    # Try to extract tables first
                    tables = page.extract_tables()
                    if tables:
                        tables_found.extend(tables)
                    
                    # Also extract text for fallback parsing
                    text = page.extract_text()
                    if text:
                        all_text += text + '\n'
                
                # Try table-based extraction first
                if tables_found:
                    self._parse_tables(tables_found)
                
                # Fallback to text-based extraction if no components found
                if not self.components and all_text:
                    self._parse_text(all_text)
                
            return True
        except Exception as e:
            print(f"PDF parse error: {e}")
            return False
    
    def _parse_tables(self, tables):
        """Extract components from PDF tables"""
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            # Try to identify header row
            header = [str(cell).lower().strip() if cell else '' for cell in table[0]]
            
            # Map common column names
            col_map = {}
            ref_keywords = ['reference', 'ref', 'designator', 'ref des', 'refdes', 'part ref']
            val_keywords = ['value', 'val', 'rating', 'component value']
            fp_keywords = ['footprint', 'package', 'case', 'size', 'land pattern']
            pn_keywords = ['part number', 'part no', 'mpn', 'mfr part', 'p/n', 'partnumber', 'manufacturer part']
            desc_keywords = ['description', 'desc', 'comment', 'name', 'component']
            qty_keywords = ['quantity', 'qty', 'count']
            
            for i, h in enumerate(header):
                if any(k in h for k in ref_keywords):
                    col_map['reference'] = i
                elif any(k in h for k in val_keywords):
                    col_map['value'] = i
                elif any(k in h for k in fp_keywords):
                    col_map['footprint'] = i
                elif any(k in h for k in pn_keywords):
                    col_map['part_number'] = i
                elif any(k in h for k in desc_keywords):
                    col_map['description'] = i
                elif any(k in h for k in qty_keywords):
                    col_map['quantity'] = i
            
            # If we identified at least a reference or value column, parse rows
            if 'reference' in col_map or 'value' in col_map:
                for row in table[1:]:
                    if not row or all(cell is None or str(cell).strip() == '' for cell in row):
                        continue
                    
                    comp = {
                        'reference': str(row[col_map['reference']]).strip() if 'reference' in col_map and row[col_map['reference']] else '',
                        'value': str(row[col_map['value']]).strip() if 'value' in col_map and row[col_map['value']] else '',
                        'footprint': str(row[col_map['footprint']]).strip() if 'footprint' in col_map and row[col_map['footprint']] else '',
                        'part_number': str(row[col_map['part_number']]).strip() if 'part_number' in col_map and row[col_map['part_number']] else '',
                        'description': str(row[col_map['description']]).strip() if 'description' in col_map and row[col_map['description']] else '',
                    }
                    
                    # Handle quantity column — expand into individual component entries
                    qty = 1
                    if 'quantity' in col_map and row[col_map['quantity']]:
                        try:
                            qty = int(str(row[col_map['quantity']]).strip())
                        except ValueError:
                            qty = 1
                    
                    # If designators are comma-separated, split them
                    refs = [r.strip() for r in comp['reference'].split(',') if r.strip()]
                    if refs:
                        for ref in refs:
                            entry = dict(comp)
                            entry['reference'] = ref
                            self.components.append(entry)
                    else:
                        for _ in range(max(qty, 1)):
                            self.components.append(dict(comp))
    
    def _parse_text(self, text):
        """Fallback: extract components from raw PDF text using regex patterns"""
        # Pattern for common component references like R1, C2, U3, etc.
        ref_pattern = r'\b([RCULDQJPXYW]\d{1,4})\b'
        refs = re.findall(ref_pattern, text)
        
        for ref in set(refs):
            # Try to find value near the reference
            val_pattern = rf'{re.escape(ref)}[\s:,]+([\d.]+[kKmMuUnNpP]?[ΩΩFHohm]*|\d+\.\d+)'
            val_match = re.search(val_pattern, text)
            value = val_match.group(1) if val_match else ''
            
            prefix = ref[0].upper()
            desc_map = {'R': 'Resistor', 'C': 'Capacitor', 'L': 'Inductor', 'U': 'IC',
                       'D': 'Diode', 'Q': 'Transistor', 'J': 'Connector', 'P': 'Connector',
                       'X': 'Crystal', 'Y': 'Crystal', 'W': 'Wire'}
            
            self.components.append({
                'reference': ref,
                'value': value,
                'footprint': '',
                'part_number': '',
                'description': desc_map.get(prefix, 'Component')
            })


def detect_file_type(filename):
    """Detect the CAD file type from extension"""
    ext = filename.lower().split('.')[-1]
    
    if ext in ['kicad_sch', 'sch'] and 'kicad' in filename.lower():
        return 'kicad'
    elif ext == 'sch':
        return 'eagle'
    elif ext == 'schdoc':
        return 'altium'
    elif ext == 'json':
        return 'easyeda'
    elif ext == 'pdf':
        return 'pdf'
    
    return None


def get_parser(file_type, filepath):
    """Get appropriate parser for file type"""
    parsers = {
        'kicad': KiCadParser,
        'eagle': EagleParser,
        'altium': AltiumParser,
        'easyeda': EasyEDAParser,
        'pdf': PDFParser
    }
    
    parser_class = parsers.get(file_type)
    if parser_class:
        return parser_class(filepath)
    return None


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and parsing"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Detect file type
    file_type = detect_file_type(filename)
    if not file_type:
        return jsonify({'error': 'Unsupported file format'}), 400
    
    # Parse file
    parser = get_parser(file_type, filepath)
    if not parser:
        return jsonify({'error': 'Parser not available'}), 400
    
    success = parser.parse()
    if not success:
        return jsonify({'error': 'Failed to parse file'}), 500
    
    # Get BOM
    bom = parser.get_bom()
    
    # Generate CSV
    df = pd.DataFrame(bom)
    csv_path = os.path.join(OUTPUT_FOLDER, f'{filename}_bom.csv')
    df.to_csv(csv_path, index=False)
    
    # Generate Excel
    excel_path = os.path.join(OUTPUT_FOLDER, f'{filename}_bom.xlsx')
    df.to_excel(excel_path, index=False, engine='openpyxl')
    
    return jsonify({
        'success': True,
        'file_type': file_type,
        'components': parser.components,
        'bom': bom,
        'csv_file': f'{filename}_bom.csv',
        'excel_file': f'{filename}_bom.xlsx',
        'total_components': len(parser.components),
        'unique_parts': len(bom)
    })


@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """Download generated BOM files"""
    filepath = os.path.join(OUTPUT_FOLDER, secure_filename(filename))
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
