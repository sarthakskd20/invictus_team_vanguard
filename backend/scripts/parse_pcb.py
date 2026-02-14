import sys
import os
import json
import re
import argparse
import xml.etree.ElementTree as ET
import pdfplumber
import pandas as pd
from werkzeug.utils import secure_filename

# Disable default print to avoid polluting stdout which we use for JSON output
# We will use sys.stderr for logs/errors

def log(message):
    sys.stderr.write(f"[INFO] {message}\n")

def error_log(message):
    sys.stderr.write(f"[ERROR] {message}\n")

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
            # Create a unique key for grouping
            key = (comp.get('value', ''), comp.get('footprint', ''), comp.get('part_number', ''))
            
            if key not in bom:
                # Infer category
                category = self.infer_category(comp)
                
                bom[key] = {
                    'designators': [],
                    'value': comp.get('value', 'N/A'),
                    'footprint': comp.get('footprint', 'N/A'),
                    'part_number': comp.get('part_number', 'N/A'),
                    'description': comp.get('description', 'N/A'),
                    'manufacturer': comp.get('manufacturer', 'N/A'),
                    'category': category,
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

    def infer_category(self, comp):
        """Infer category based on Reference Designator and Value/Description"""
        ref = comp.get('reference', '').upper()
        val = comp.get('value', '').upper()
        desc = comp.get('description', '').upper()
        
        # 1. Keyword search in Description/Value
        text = f"{val} {desc}"
        if "RESISTOR" in text or "RES " in text: return "Resistors"
        if "CAPACITOR" in text or "CAP " in text: return "Capacitors"
        if "INDUCTOR" in text: return "Inductors"
        if "DIODE" in text: return "Diodes"
        if "LED" in text: return "LEDs"
        if "TRANSISTOR" in text or "MOSFET" in text: return "Transistors"
        if "MICROCONTROLLER" in text or "MCU" in text: return "Microcontrollers"
        if "CONNECTOR" in text or "HEADER" in text: return "Connectors"
        if "SWITCH" in text: return "Switches"
        if "CRYSTAL" in text or "OSCILLATOR" in text: return "Crystals"
        
        # 2. Reference Designator Prefix
        prefix = re.match(r'^([A-Z]+)', ref)
        if prefix:
            p = prefix.group(1)
            if p == 'R': return "Resistors"
            if p == 'C': return "Capacitors"
            if p == 'L': return "Inductors"
            if p == 'D': return "Diodes" # Could be LED too, but Diode is safer generic
            if p == 'Q': return "Transistors"
            if p == 'U' or p == 'IC':
                # Check for specific IC types
                if "STM32" in val or "ATMEGA" in val or "ESP" in val: return "Microcontrollers"
                return "ICs"
            if p == 'J' or p == 'P': return "Connectors"
            if p == 'SW' or p == 'S': return "Switches"
            if p == 'X' or p == 'Y': return "Crystals"
            if p == 'F': return "Fuses"
            if p == 'M': return "Modules"
            
        return "Uncategorized"


class KiCadParser(ComponentParser):
    """Parser for KiCad schematic files (.kicad_sch)"""
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            self.components = self._parse_sexpr(content)
            return True
        except Exception as e:
            error_log(f"KiCad parse error: {e}")
            return False
    
    def _parse_sexpr(self, content):
        """Parse KiCad S-expression format"""
        components = []
        
        # Simple regex-based parsing for symbols
        # Matches: (symbol (lib_id "...") (at ...) ... (property "Reference" "..." ... (property "Value" "..."
        symbol_pattern = r'\(symbol\s+\(lib_id\s+"([^"]+)"\)\s+\(at\s+[\d.\s-]+\)\s+.*?\(property\s+"Reference"\s+"([^"]+)".*?\(property\s+"Value"\s+"([^"]+)"'
        
        matches = re.finditer(symbol_pattern, content, re.DOTALL)
        
        for match in matches:
            lib_id = match.group(1)
            reference = match.group(2)
            value = match.group(3)
            
            full_match = match.group(0)
            
            # Extract footprint if present
            footprint_match = re.search(r'\(property\s+"Footprint"\s+"([^"]+)"', full_match)
            footprint = footprint_match.group(1) if footprint_match else ''
            
            # Extract part number if present (common fields: PartNumber, MPN, MfrPart, etc.)
            part_number = ''
            pn_match = re.search(r'\(property\s+"(?:PartNumber|MPN|MfrPart|SupplierPart)"\s+"([^"]+)"', full_match, re.IGNORECASE)
            if pn_match:
                part_number = pn_match.group(1)
                
            components.append({
                'reference': reference,
                'value': value,
                'footprint': footprint,
                'part_number': part_number,
                'library': lib_id,
                'description': f'{lib_id} - {value}',
                'manufacturer': '' 
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
                
                # Try to resolve Part Number from common attribute names
                pn = attributes.get('PARTNUMBER') or attributes.get('MPN') or attributes.get('MFR_PART') or ''
                mfr = attributes.get('MANUFACTURER') or attributes.get('MFR') or ''

                self.components.append({
                    'reference': reference,
                    'value': value,
                    'footprint': device,
                    'part_number': pn,
                    'description': f'{deviceset}{device}',
                    'manufacturer': mfr
                })
            
            return True
        except Exception as e:
            error_log(f"Eagle parse error: {e}")
            return False


class AltiumParser(ComponentParser):
    """Parser for Altium schematic files (.SchDoc) - Simplified Text Extraction"""
    
    def parse(self):
        try:
            # Altium files are binary compound files. 
            # This is a VERY simplified text extraction method and is not guaranteed to work for all versions.
            with open(self.filepath, 'rb') as f:
                content = f.read()
            
            # Extract text strings
            text_content = content.decode('utf-8', errors='ignore')
            
            # Look for component patterns: Designator=...|...|Comment=...
            # This regex is heuristic
            comp_pattern = r'Designator=([^\x00\|]+).*?Comment=([^\x00\|]+)'
            matches = re.finditer(comp_pattern, text_content, re.DOTALL)
            
            seen_refs = set()

            for match in matches:
                reference = match.group(1).strip()
                value = match.group(2).strip()
                
                if reference and reference not in seen_refs:
                    seen_refs.add(reference)
                    self.components.append({
                        'reference': reference,
                        'value': value,
                        'footprint': '',
                        'part_number': '',
                        'description': value,
                        'manufacturer': ''
                    })
            
            return True
        except Exception as e:
            error_log(f"Altium parse error: {e}")
            return False


class EasyEDAParser(ComponentParser):
    """Parser for EasyEDA JSON files"""
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            shapes = []
            if isinstance(data, dict):
                shapes = data.get('shape', [])
            elif isinstance(data, list):
                shapes = data
            else:
                return False
            
            for shape in shapes:
                # 'gge' == 'LIB' usually indicates a component instance
                if isinstance(shape, dict) and shape.get('gge') == 'LIB':
                    attrs = shape.get('attrs', {})
                    
                    self.components.append({
                        'reference': attrs.get('Designator', ''),
                        'value': attrs.get('Value', ''),
                        'footprint': attrs.get('Footprint', ''),
                        'part_number': attrs.get('Supplier Part') or attrs.get('MPN', ''),
                        'description': attrs.get('Description', ''),
                        'manufacturer': attrs.get('Manufacturer', '')
                    })
            
            return True
        except Exception as e:
            error_log(f"EasyEDA parse error: {e}")
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
            error_log(f"PDF parse error: {e}")
            return False
    
    def _parse_tables(self, tables):
        """Extract components from PDF tables"""
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            # Clean header
            header = [str(cell).lower().strip().replace('\n', ' ') if cell else '' for cell in table[0]]
            
            # Map common column names
            col_map = {}
            ref_keywords = ['reference', 'ref', 'designator', 'ref des', 'refdes', 'part ref']
            val_keywords = ['value', 'val', 'rating', 'component value']
            fp_keywords = ['footprint', 'package', 'case', 'size', 'land pattern']
            pn_keywords = ['part number', 'part no', 'mpn', 'mfr part', 'p/n', 'partnumber', 'manufacturer part']
            desc_keywords = ['description', 'desc', 'comment', 'name', 'component']
            qty_keywords = ['quantity', 'qty', 'count', 'amount']
            
            for i, h in enumerate(header):
                if any(k in h for k in ref_keywords): col_map['reference'] = i
                elif any(k in h for k in val_keywords): col_map['value'] = i
                elif any(k in h for k in fp_keywords): col_map['footprint'] = i
                elif any(k in h for k in pn_keywords): col_map['part_number'] = i
                elif any(k in h for k in desc_keywords): col_map['description'] = i
                elif any(k in h for k in qty_keywords): col_map['quantity'] = i
            
            # If we identified at least a reference or value column, parse rows
            if 'reference' in col_map or 'value' in col_map:
                for row in table[1:]:
                    if not row or all(cell is None or str(cell).strip() == '' for cell in row):
                        continue
                    
                    # Helper to safely get cell content
                    def get_cell(idx):
                        if idx is not None and idx < len(row) and row[idx]:
                            return str(row[idx]).strip().replace('\n', ' ')
                        return ''

                    comp = {
                        'reference': get_cell(col_map.get('reference')),
                        'value': get_cell(col_map.get('value')),
                        'footprint': get_cell(col_map.get('footprint')),
                        'part_number': get_cell(col_map.get('part_number')),
                        'description': get_cell(col_map.get('description')),
                        'manufacturer': ''
                    }
                    
                    # Skip empty rows
                    if not comp['reference'] and not comp['value']:
                        continue

                    # Handle quantity column — expand into individual component entries
                    qty = 1
                    qty_idx = col_map.get('quantity')
                    if qty_idx is not None:
                        try:
                            qty_val = get_cell(qty_idx)
                            if qty_val:
                                qty = int(re.sub(r'[^\d]', '', qty_val))
                        except ValueError:
                            qty = 1
                    
                    # Logic: If refs are comma separated (C1, C2, C3), create entry for each.
                    # If refs is "C1..C3", that's harder, but let's handle commas/spaces.
                    if comp['reference']:
                        refs = re.split(r'[,;\s]+', comp['reference'])
                        refs = [r for r in refs if r]
                        
                        if refs:
                            for ref in refs:
                                entry = dict(comp)
                                entry['reference'] = ref
                                self.components.append(entry)
                        else:
                            # Fallback if split failed but ref existed
                            self.components.append(comp)
                    else:
                        # No reference, but maybe qty > 1? Add placeholder entries?
                        # Without reference, it's hard to be a component in inventory. 
                        # We'll skip for now if no reference.
                        pass
    
    def _parse_text(self, text):
        """Fallback: extract components from raw PDF text using regex patterns"""
        # Pattern for common component references like R1, C2, U3, etc.
        # Captures Ref and potential Value next to it
        
        # This is a very basic heuristic.
        # Look for "Ax", "Cx", "Rx", "Ux", "Dx" etc followed by numbers
        ref_pattern = r'\b([RCULDQJPXYW]\d{1,4})\b'
        refs = sorted(list(set(re.findall(ref_pattern, text))))
        
        for ref in refs:
            # Try to find value near the reference (heuristic)
            # e.g., "R1 10k" or "C2 100nF"
            # Look ahead in text for a value-like string
            val_pattern = rf'{re.escape(ref)}\s+([0-9.]+[kKmMuUnNpP]?[ΩΩFHohmVA]*)'
            val_match = re.search(val_pattern, text, re.IGNORECASE)
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
                'description': desc_map.get(prefix, 'Component'),
                'manufacturer': ''
            })


def detect_file_type(filename):
    """Detect the CAD file type from extension"""
    ext = filename.lower().split('.')[-1]
    name = filename.lower()
    
    if ext == 'kicad_sch' or (ext == 'sch' and 'kicad' in name):
        return 'kicad'
    elif ext == 'sch':
        return 'eagle' # Default .sch to Eagle if not obviously KiCad
    elif ext == 'schdoc':
        return 'altium'
    elif ext == 'json':
        return 'easyeda'
    elif ext == 'pdf':
        return 'pdf'
    
    return None

def main():
    parser = argparse.ArgumentParser(description='Parse PCB Design Files')
    parser.add_argument('filepath', help='Path to the PCB file')
    args = parser.parse_args()
    
    if not os.path.exists(args.filepath):
        sys.stderr.write(f"Error: File not found {args.filepath}\n")
        sys.exit(1)
        
    filename = os.path.basename(args.filepath)
    file_type = detect_file_type(filename)
    
    log(f"Detected file type: {file_type} for {filename}")
    
    if not file_type:
        sys.stderr.write("Error: Unsupported file format\n")
        sys.exit(1)
        
    parsers = {
        'kicad': KiCadParser,
        'eagle': EagleParser,
        'altium': AltiumParser,
        'easyeda': EasyEDAParser,
        'pdf': PDFParser
    }
    
    parser_class = parsers.get(file_type)
    if not parser_class:
        sys.stderr.write("Error: No parser available for this type\n")
        sys.exit(1)
        
    parser_instance = parser_class(args.filepath)
    success = parser_instance.parse()
    
    if not success:
        sys.stderr.write("Error: Failed to parse file\n")
        sys.exit(1)
        
    # Get BOM and print as JSON to stdout
    bom = parser_instance.get_bom()
    
    output = {
        "success": True,
        "file_type": file_type,
        "total_components": len(parser_instance.components),
        "bom": bom
    }
    
    print(json.dumps(output, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
