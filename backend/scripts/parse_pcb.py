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
        """Infer category using multi-layer classification:
        Layer 1: Value-based regex patterns (most specific)
        Layer 2: Keyword search in description/value
        Layer 3: Part-number prefix matching for IC families
        Layer 4: Reference designator prefix (broadest fallback)
        """
        ref = comp.get('reference', '').upper().strip()
        val = comp.get('value', '').upper().strip()
        desc = comp.get('description', '').upper().strip()
        footprint = comp.get('footprint', '').upper().strip()
        part_number = comp.get('part_number', '').upper().strip()
        text = f"{val} {desc} {part_number}"

        # ── Layer 1: Value-based regex patterns ──────────────────────
        # Resistor values: 10k, 4.7R, 100Ω, 1M, 2.2kohm, 0R, 470R
        if re.match(r'^[\d.]+\s*[kKmMRΩ]\s*$', val) or re.match(r'^[\d.]+\s*(ohm|kohm|mohm|[kKmM]?Ω)\s*$', val, re.IGNORECASE):
            return "Resistors"
        # Capacitor values: 100nF, 10uF, 47pF, 1µF, 4.7uf
        if re.match(r'^[\d.]+\s*[nuNUpPµ]?[fF]\s*$', val):
            return "Capacitors"
        # Inductor values: 10uH, 100mH, 4.7µH, 1nH
        if re.match(r'^[\d.]+\s*[nuNUmMµ]?[hH]\s*$', val):
            return "Inductors"

        # ── Layer 2: Keyword search in text ──────────────────────────
        # Resistors
        if any(k in text for k in ["RESISTOR", "RES ", "THICK FILM", "THIN FILM", "CHIP RESISTOR", "POTENTIOMETER", "TRIMMER", "THERMISTOR", "NTC", "PTC", "VARISTOR"]):
            return "Resistors"
        # Capacitors
        if any(k in text for k in ["CAPACITOR", "CAP ", "MLCC", "CERAMIC CAP", "ELECTROLYTIC", "TANTALUM", "SUPERCAP"]):
            return "Capacitors"
        # Inductors
        if any(k in text for k in ["INDUCTOR", "CHOKE", "FERRITE BEAD", "FERRITE", "COIL"]):
            return "Inductors"
        # Diodes
        if any(k in text for k in ["DIODE", "RECTIFIER", "SCHOTTKY", "ZENER", "TVS", "ESD PROTECTION"]):
            return "Diodes"
        # LEDs
        if any(k in text for k in [" LED", "LED ", "LIGHT EMITTING", "WS2812", "SK6812", "NEOPIXEL", "INDICATOR"]):
            return "LEDs"
        # Transistors
        if any(k in text for k in ["TRANSISTOR", "MOSFET", "JFET", "BJT", "IGBT", "DARLINGTON", "NPN", "PNP", "N-CH", "P-CH", "N-CHANNEL", "P-CHANNEL"]):
            return "Transistors"
        # Voltage Regulators
        if any(k in text for k in ["REGULATOR", "VOLTAGE REG", "LDO", "LINEAR REG", "VREG"]):
            return "Voltage Regulators"
        # Power Management
        if any(k in text for k in ["BUCK", "BOOST", "DC-DC", "DCDC", "POWER SUPPLY", "SMPS", "CHARGE PUMP", "BATTERY CHARGER", "PMIC"]):
            return "Power Management"
        # Op-Amps
        if any(k in text for k in ["OP-AMP", "OPAMP", "OP AMP", "OPERATIONAL AMPLIFIER", "COMPARATOR", "INSTRUMENTATION AMP"]):
            return "Op-Amps"
        # Microcontrollers
        if any(k in text for k in ["MICROCONTROLLER", "MCU", "MICROPROCESSOR", "MPU", "SOC"]):
            return "Microcontrollers"
        # Connectors
        if any(k in text for k in ["CONNECTOR", "HEADER", "TERMINAL", "SOCKET", "PLUG", "JACK", "USB", "BARREL JACK", "PIN HEADER", "JST", "MOLEX"]):
            return "Connectors"
        # Switches
        if any(k in text for k in ["SWITCH", "PUSHBUTTON", "PUSH BUTTON", "TACT ", "TACTILE", "DIP SWITCH", "TOGGLE"]):
            return "Switches"
        # Crystals & Oscillators
        if any(k in text for k in ["CRYSTAL", "OSCILLATOR", "XTAL", "RESONATOR", "TCXO", "VCXO"]):
            return "Crystals & Oscillators"
        # Sensors
        if any(k in text for k in ["SENSOR", "ACCELEROMETER", "GYROSCOPE", "IMU", "TEMPERATURE SENSOR", "HUMIDITY", "PRESSURE SENSOR", "PROXIMITY", "HALL EFFECT", "THERMOCOUPLE", "PHOTODIODE", "PHOTOTRANSISTOR"]):
            return "Sensors"
        # Communication ICs
        if any(k in text for k in ["TRANSCEIVER", "UART", "RS232", "RS485", "CAN BUS", "SPI ", "I2C ", "ETHERNET PHY", "WIFI", "WI-FI", "BLUETOOTH", "BLE", "LORA", "ZIGBEE", "RF MODULE"]):
            return "Communication ICs"
        # Memory
        if any(k in text for k in ["EEPROM", "FLASH", "SRAM", "DRAM", "SDRAM", "FRAM", "MRAM", "NOR FLASH", "NAND"]):
            return "Memory"
        # Display
        if any(k in text for k in ["DISPLAY", "LCD", "OLED", "TFT", "SCREEN", "7-SEGMENT", "SEVEN SEGMENT"]):
            return "Displays"
        # Transformers & Relays
        if any(k in text for k in ["TRANSFORMER", "RELAY", "SOLENOID", "BUZZER", "SPEAKER", "MOTOR DRIVER"]):
            return "Electromechanical"
        # Fuses
        if any(k in text for k in ["FUSE", "POLYFUSE", "PPTC", "RESETTABLE FUSE"]):
            return "Fuses"
        # Test Points
        if "TEST POINT" in text or "TESTPOINT" in text:
            return "Test Points"

        # ── Layer 3: Part-number prefix matching ─────────────────────
        pn = part_number if part_number else val
        if pn:
            # Voltage Regulators
            if re.match(r'^(LM78|LM79|LM317|LM1117|AMS1117|AP2112|MCP1700|MIC5219|TLV1117|NCP1117|LD1117|HT7333|HT7533|AP1117)', pn):
                return "Voltage Regulators"
            # Power Management
            if re.match(r'^(LM2596|LM2576|MP1584|TPS54|TPS56|TPS61|TPS62|LTC3|LT1|LT3|LT8|RT8|SY8|AOZ|MPM)', pn):
                return "Power Management"
            # Op-Amps
            if re.match(r'^(LM358|LM324|LM393|LM339|TL07|TL08|NE5532|OPA|AD8|INA|MCP60|LMV3|LMH)', pn):
                return "Op-Amps"
            # Microcontrollers
            if re.match(r'^(STM32|ATMEGA|ATTINY|PIC1|PIC2|PIC3|ESP32|ESP8266|RP2040|SAMD|NRF5|EFM32|MSP430|CY8C)', pn):
                return "Microcontrollers"
            # Communication ICs
            if re.match(r'^(MAX232|MAX485|MAX3232|SP3232|FT232|FT2232|CH340|CP210|SI446|SX127|RFM9|CC1101|W5500|ENC28J60|MCP2515|MCP2551|SN65HVD)', pn):
                return "Communication ICs"
            # Logic ICs
            if re.match(r'^(74HC|74LS|74AHC|74LVC|CD40|SN74|MC14)', pn):
                return "Logic ICs"
            # Sensors
            if re.match(r'^(BME|BMP|BMA|BMI|MPU6|LSM6|LIS3|ADXL|HMC5|QMC5|SI70|SHT|AHT|DHT|DS18B|LM35|TMP|MAX31|MAX6675|APDS|VL53|TSL2|BH17|INA2|ACS7)', pn):
                return "Sensors"
            # Memory
            if re.match(r'^(AT24C|AT25|W25Q|W25N|MX25|SST25|SST26|IS25|MT41|IS42|IS62|CY7C|23LC|FM24|MB85)', pn):
                return "Memory"
            # Diode part numbers
            if re.match(r'^(1N4|1N5|BAT5|BAV|BAS|SS1|SS3|SK[0-9]|MBR|SB[0-9]|ES[0-9]|US[0-9]|B[0-9]+20)', pn):
                return "Diodes"
            # LED drivers
            if re.match(r'^(WS2812|SK6812|APA102|TLC59|PCA9685|IS31)', pn):
                return "LEDs"
            # Transistor part numbers
            if re.match(r'^(2N[0-9]|BC[0-9]|BD[0-9]|BF[0-9]|BS[0-9]|IRF|IRFZ|AO[0-9]|SI[0-9]|FQP|IRL)', pn):
                return "Transistors"
            # Display drivers
            if re.match(r'^(SSD1306|ST7735|ST7789|ILI9|HT16K33|MAX72|TM16|TM17)', pn):
                return "Displays"

        # ── Layer 4: Reference Designator Prefix ─────────────────────
        prefix = re.match(r'^([A-Z]+)', ref)
        if prefix:
            p = prefix.group(1)
            ref_map = {
                'R': "Resistors", 'C': "Capacitors", 'L': "Inductors",
                'D': "Diodes", 'Q': "Transistors",
                'J': "Connectors", 'P': "Connectors", 'CN': "Connectors",
                'SW': "Switches", 'S': "Switches",
                'X': "Crystals & Oscillators", 'Y': "Crystals & Oscillators",
                'F': "Fuses", 'FB': "Inductors",
                'TP': "Test Points", 'T': "Transformers",
                'K': "Electromechanical", 'RY': "Electromechanical",
                'BT': "Batteries", 'DS': "LEDs",
                'M': "Modules", 'A': "Modules",
            }
            if p in ref_map:
                return ref_map[p]
            if p in ('U', 'IC'):
                # Sub-classify ICs using the text layers above (already tried)
                return "ICs"

        return "Uncategorized"


class KiCadParser(ComponentParser):
    """Parser for KiCad schematic files (.kicad_sch and legacy .sch)"""
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Detect format: legacy EESchema vs modern S-expression
            if content.strip().startswith('EESchema') or '$Comp' in content[:2000]:
                self.components = self._parse_legacy(content)
            else:
                self.components = self._parse_sexpr(content)
            return True
        except Exception as e:
            error_log(f"KiCad parse error: {e}")
            return False
    
    def _parse_legacy(self, content):
        """Parse KiCad legacy format (EESchema, $Comp/$EndComp blocks)"""
        components = []
        
        # Split into $Comp...$EndComp blocks
        comp_blocks = re.findall(r'\$Comp\s*\n(.*?)\$EndComp', content, re.DOTALL)
        
        for block in comp_blocks:
            lines = block.strip().splitlines()
            
            reference = ''
            value = ''
            footprint = ''
            part_number = ''
            description = ''
            manufacturer = ''
            lib_id = ''
            
            for line in lines:
                line = line.strip()
                
                # L <library>:<device> <reference>
                if line.startswith('L '):
                    parts = line.split()
                    if len(parts) >= 3:
                        lib_id = parts[1]  # e.g., Device:R_US
                        reference = parts[2]  # e.g., R1
                
                # F fields: F <index> "<value>" ...
                if line.startswith('F '):
                    f_match = re.match(r'F\s+(\d+)\s+"([^"]*)"', line)
                    if f_match:
                        f_idx = int(f_match.group(1))
                        f_val = f_match.group(2)
                        
                        if f_idx == 0:  # F 0 = Reference designator display
                            if not reference:  # Only use if L line didn't provide it
                                reference = f_val
                        elif f_idx == 1:  # F 1 = Value
                            value = f_val
                        elif f_idx == 2:  # F 2 = Footprint
                            footprint = f_val
                        elif f_idx == 3:  # F 3 = Datasheet/URL
                            pass  # Skip datasheet
                        elif f_idx >= 4:  # F 4+ = Custom fields
                            # Check for part number or MPN in custom field name
                            field_name_match = re.search(r'"([^"]*)"\s*$', line)
                            if field_name_match:
                                field_name = field_name_match.group(1).upper()
                                if field_name in ('PARTNUMBER', 'MPN', 'MFR_PART', 'PART_NUMBER', 'MANF_PART'):
                                    if f_val and f_val != '~':
                                        part_number = f_val
                                elif field_name in ('MANUFACTURER', 'MFR', 'MANF'):
                                    if f_val and f_val != '~':
                                        manufacturer = f_val
            
            # Skip power symbols and flags (references starting with #)
            if reference and not reference.startswith('#'):
                # Use lib_id for description if available
                if lib_id:
                    description = lib_id.replace(':', ' - ')
                
                # Generate part number from reference + value if not found
                if not part_number and value and value != '~':
                    part_number = f"{reference}_{value}".replace(' ', '_')
                
                components.append({
                    'reference': reference,
                    'value': value if value and value != '~' else '',
                    'footprint': footprint if footprint and footprint != '~' else '',
                    'part_number': part_number,
                    'description': description,
                    'manufacturer': manufacturer
                })
        
        return components
    
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


class GerberParser(ComponentParser):
    """Parser for Gerber pick-and-place / centroid files (.gbr)
    
    Note: Standard Gerber artwork files only contain drawing commands
    and do not embed BOM data. This parser targets pick-and-place
    or centroid-style .gbr files that contain component placement info,
    and falls back to extracting reference designators from comments.
    """
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            lines = content.splitlines()
            seen_refs = set()
            
            for line in lines:
                line = line.strip()
                
                # Method 1: Parse G04 comment lines that may contain component info
                # e.g., G04 Component: R1 10k 0402*
                if line.startswith('G04'):
                    comment = line[3:].strip().rstrip('*')
                    # Try to extract ref designator from comment
                    ref_match = re.search(r'\b([RCULDQJPXYSW][A-Z]?\d{1,4})\b', comment)
                    if ref_match:
                        ref = ref_match.group(1)
                        if ref not in seen_refs:
                            seen_refs.add(ref)
                            # Try to extract value after ref
                            remaining = comment[ref_match.end():].strip()
                            val_match = re.match(r'([\w.]+[kKmMuUnNpPΩ]?[FfHhΩ]?)', remaining)
                            value = val_match.group(1) if val_match else ''
                            
                            self.components.append({
                                'reference': ref,
                                'value': value,
                                'footprint': '',
                                'part_number': '',
                                'description': f'From Gerber comment: {comment[:60]}',
                                'manufacturer': ''
                            })
                    continue
                
                # Method 2: Pick-and-place CSV-like lines in Gerber wrapper
                # Some tools export: RefDes,Footprint,X,Y,Rotation,Side
                if ',' in line and not line.startswith('%') and not line.startswith('G') and not line.startswith('D'):
                    parts = [p.strip().strip('"') for p in line.split(',')]
                    if len(parts) >= 2:
                        potential_ref = parts[0]
                        if re.match(r'^[RCULDQJPXYSW][A-Z]?\d{1,4}$', potential_ref) and potential_ref not in seen_refs:
                            seen_refs.add(potential_ref)
                            footprint = parts[1] if len(parts) > 1 else ''
                            value = parts[2] if len(parts) > 2 else ''
                            
                            self.components.append({
                                'reference': potential_ref,
                                'value': value,
                                'footprint': footprint,
                                'part_number': '',
                                'description': '',
                                'manufacturer': ''
                            })
            
            # Method 3: Fallback — scan entire content for reference designator patterns
            if not self.components:
                ref_pattern = r'\b([RCULDQJPXYSW][A-Z]?\d{1,4})\b'
                all_refs = sorted(set(re.findall(ref_pattern, content)))
                for ref in all_refs:
                    self.components.append({
                        'reference': ref,
                        'value': '',
                        'footprint': '',
                        'part_number': '',
                        'description': 'Extracted from Gerber file',
                        'manufacturer': ''
                    })
            
            return True
        except Exception as e:
            error_log(f"Gerber parse error: {e}")
            return False


class IPC2581Parser(ComponentParser):
    """Parser for IPC-2581 XML files (.xml, .cvg)
    
    IPC-2581 is a standard manufacturing data format. BOM data is in
    <BomItem> elements within <Bom> sections.
    """
    
    def parse(self):
        try:
            tree = ET.parse(self.filepath)
            root = tree.getroot()
            
            # Handle namespace if present
            ns = ''
            root_tag = root.tag
            if '{' in root_tag:
                ns = root_tag.split('}')[0] + '}'
            
            # Find BomItem elements
            bom_items = root.findall(f'.//{ns}BomItem') or root.findall('.//BomItem')
            
            for item in bom_items:
                ref_des_list = []
                for ref in item.findall(f'{ns}RefDes') or item.findall('RefDes'):
                    rd = ref.get('name', '') or ref.text or ''
                    if rd.strip():
                        ref_des_list.append(rd.strip())
                
                # Get component attributes
                part_number = item.get('OEMDesignNumberRef', '') or item.get('partNumber', '')
                description = item.get('description', '')
                
                # Try to find characteristics
                char_elem = item.find(f'{ns}Characteristics') or item.find('Characteristics')
                value = ''
                footprint = ''
                if char_elem is not None:
                    for c in char_elem:
                        cname = c.get('name', '').upper()
                        cval = c.get('value', '') or c.text or ''
                        if 'VALUE' in cname:
                            value = cval
                        elif 'FOOTPRINT' in cname or 'PACKAGE' in cname:
                            footprint = cval
                
                for ref in ref_des_list if ref_des_list else ['']:
                    self.components.append({
                        'reference': ref,
                        'value': value,
                        'footprint': footprint,
                        'part_number': part_number,
                        'description': description,
                        'manufacturer': ''
                    })
            
            # Fallback: try generic Component elements
            if not self.components:
                for comp in root.findall(f'.//{ns}Component') or root.findall('.//Component'):
                    ref = comp.get('refDes', '') or comp.get('name', '')
                    pn = comp.get('partNumber', '') or comp.get('part', '')
                    val = comp.get('value', '')
                    pkg = comp.get('packageRef', '') or comp.get('package', '')
                    
                    if ref or pn:
                        self.components.append({
                            'reference': ref,
                            'value': val,
                            'footprint': pkg,
                            'part_number': pn,
                            'description': '',
                            'manufacturer': ''
                        })
            
            return True
        except Exception as e:
            error_log(f"IPC-2581 parse error: {e}")
            return False


class ODBPlusPlusParser(ComponentParser):
    """Parser for ODB++ manufacturing files (.tgz, .tar.gz, directories)
    
    ODB++ stores BOM data in structured text files within a bom/ subdirectory.
    """
    
    def parse(self):
        import tarfile
        import tempfile
        
        try:
            extract_dir = None
            
            # If it's a tarball, extract it
            if tarfile.is_tarfile(self.filepath):
                extract_dir = tempfile.mkdtemp(prefix='odb_')
                with tarfile.open(self.filepath, 'r:*') as tar:
                    tar.extractall(extract_dir)
                search_dir = extract_dir
            else:
                search_dir = os.path.dirname(self.filepath)
            
            # Find BOM-related files in the ODB++ structure
            bom_found = False
            for root_dir, dirs, files in os.walk(search_dir):
                for f in files:
                    fname = f.lower()
                    # ODB++ stores component data in steps/*/layers/* or matrix/matrix
                    if fname in ('bom', 'bom.txt', 'components', 'comp_lib'):
                        bom_found = True
                        self._parse_odb_bom(os.path.join(root_dir, f))
                    elif fname == 'features' and 'comp' in root_dir.lower():
                        bom_found = True
                        self._parse_odb_features(os.path.join(root_dir, f))
            
            # Cleanup temp directory
            if extract_dir:
                import shutil
                shutil.rmtree(extract_dir, ignore_errors=True)
            
            if not bom_found:
                # Fallback: scan entire content for reference designators
                with open(self.filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                ref_pattern = r'\b([RCULDQJPXYSW][A-Z]?\d{1,4})\b'
                for ref in sorted(set(re.findall(ref_pattern, content))):
                    self.components.append({
                        'reference': ref, 'value': '', 'footprint': '',
                        'part_number': '', 'description': 'Extracted from ODB++',
                        'manufacturer': ''
                    })
            
            return True
        except Exception as e:
            error_log(f"ODB++ parse error: {e}")
            return False
    
    def _parse_odb_bom(self, filepath):
        """Parse structured BOM text file from ODB++ package"""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # Try tab/semicolon separated fields
                parts = re.split(r'[\t;|]+', line)
                if len(parts) >= 2:
                    potential_ref = parts[0].strip()
                    if re.match(r'^[RCULDQJPXYSW][A-Z]?\d{1,4}$', potential_ref):
                        self.components.append({
                            'reference': potential_ref,
                            'value': parts[1].strip() if len(parts) > 1 else '',
                            'footprint': parts[2].strip() if len(parts) > 2 else '',
                            'part_number': parts[3].strip() if len(parts) > 3 else '',
                            'description': parts[4].strip() if len(parts) > 4 else '',
                            'manufacturer': ''
                        })
        except Exception as e:
            error_log(f"ODB++ BOM file parse error: {e}")
    
    def _parse_odb_features(self, filepath):
        """Parse ODB++ component features file"""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Look for component property lines
            # Format: #<ref_des> <property>=<value>
            ref_pattern = r'\b([RCULDQJPXYSW][A-Z]?\d{1,4})\b'
            for ref in sorted(set(re.findall(ref_pattern, content))):
                self.components.append({
                    'reference': ref, 'value': '', 'footprint': '',
                    'part_number': '', 'description': 'From ODB++ features',
                    'manufacturer': ''
                })
        except Exception as e:
            error_log(f"ODB++ features parse error: {e}")


class OrCADNetlistParser(ComponentParser):
    """Parser for OrCAD/Allegro netlist and BOM export files
    
    Handles .net netlists and .asc BOM exports from OrCAD Capture/Allegro.
    """
    
    def parse(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            lines = content.splitlines()
            
            # Method 1: OrCAD netlist format
            # Looks for component blocks: ( <refdes> <footprint> <value> ... )
            comp_block = re.findall(
                r'\(\s*([RCULDQJPXYSW][A-Z]?\d{1,4})\s+([^\s)]+)\s+(?:"([^"]*)"|([^\s)]+))',
                content
            )
            
            if comp_block:
                for match in comp_block:
                    ref, footprint, val_quoted, val_unquoted = match
                    value = val_quoted if val_quoted else val_unquoted
                    self.components.append({
                        'reference': ref.strip(),
                        'value': value.strip(),
                        'footprint': footprint.strip(),
                        'part_number': '',
                        'description': '',
                        'manufacturer': ''
                    })
                return True
            
            # Method 2: Allegro BOM export (.asc tab-separated)
            # Detect header line
            header_idx = None
            for i, line in enumerate(lines):
                low = line.lower()
                if ('refdes' in low or 'designator' in low) and ('value' in low or 'part' in low):
                    header_idx = i
                    break
            
            if header_idx is not None:
                # Parse as TSV/CSV
                sep = '\t' if '\t' in lines[header_idx] else ','
                headers = [h.strip().lower() for h in lines[header_idx].split(sep)]
                
                col_map = {}
                ref_keys = ['refdes', 'ref des', 'designator', 'reference']
                val_keys = ['value', 'val']
                fp_keys = ['footprint', 'package', 'pcb footprint']
                pn_keys = ['part number', 'partno', 'mpn', 'part_number']
                desc_keys = ['description', 'comp name', 'component']
                
                for i, h in enumerate(headers):
                    if any(k in h for k in ref_keys): col_map['reference'] = i
                    elif any(k in h for k in val_keys): col_map['value'] = i
                    elif any(k in h for k in fp_keys): col_map['footprint'] = i
                    elif any(k in h for k in pn_keys): col_map['part_number'] = i
                    elif any(k in h for k in desc_keys): col_map['description'] = i
                
                for line in lines[header_idx + 1:]:
                    if not line.strip():
                        continue
                    fields = line.split(sep)
                    
                    def get_f(key):
                        idx = col_map.get(key)
                        if idx is not None and idx < len(fields):
                            return fields[idx].strip().strip('"')
                        return ''
                    
                    ref = get_f('reference')
                    if ref:
                        self.components.append({
                            'reference': ref,
                            'value': get_f('value'),
                            'footprint': get_f('footprint'),
                            'part_number': get_f('part_number'),
                            'description': get_f('description'),
                            'manufacturer': ''
                        })
                return True
            
            # Method 3: Fallback - regex scan for designators
            ref_pattern = r'\b([RCULDQJPXYSW][A-Z]?\d{1,4})\b'
            for ref in sorted(set(re.findall(ref_pattern, content))):
                self.components.append({
                    'reference': ref, 'value': '', 'footprint': '',
                    'part_number': '', 'description': 'From OrCAD netlist',
                    'manufacturer': ''
                })
            
            return True
        except Exception as e:
            error_log(f"OrCAD parse error: {e}")
            return False


def detect_file_type(filename, filepath=None):
    """Detect the CAD file type from extension and filename hints"""
    ext = filename.lower().split('.')[-1]
    name = filename.lower()
    
    # Two-extension check for .tar.gz
    if name.endswith('.tar.gz'):
        return 'odb'
    
    # Use filepath for content sniffing (defaults to filename if not provided)
    sniff_path = filepath or filename
    
    if ext == 'kicad_sch' or (ext == 'sch' and 'kicad' in name):
        return 'kicad'
    elif ext == 'sch':
        # Sniff content to distinguish KiCad legacy (.sch) from Eagle XML (.sch)
        try:
            with open(sniff_path, 'r', encoding='utf-8', errors='ignore') as f:
                head = f.read(200)
            if head.strip().startswith('EESchema') or '$Comp' in head:
                return 'kicad'
            elif head.strip().startswith('<?xml') or head.strip().startswith('<eagle'):
                return 'eagle'
            else:
                # Default: try KiCad first (more common for .sch these days)
                return 'kicad'
        except:
            return 'kicad'  # Default to KiCad on read failure
    elif ext == 'schdoc' or ext == 'pcbdoc' or ext == 'bomdoc':
        return 'altium'
    elif ext == 'json':
        return 'easyeda'
    elif ext == 'pdf':
        return 'pdf'
    elif ext == 'gbr':
        return 'gerber'
    elif ext == 'tgz':
        return 'odb'
    elif ext in ('net', 'asc') or (ext == 'brd' and 'orcad' in name):
        return 'orcad'
    elif ext == 'xml' or ext == 'cvg':
        # Sniff content to distinguish IPC-2581 from Eagle XML
        try:
            with open(sniff_path, 'r', encoding='utf-8', errors='ignore') as f:
                head = f.read(2000)
            if 'IPC-2581' in head or 'BomItem' in head or 'ipc2581' in head.lower():
                return 'ipc2581'
            else:
                return 'eagle'  # Default XML to Eagle
        except:
            return 'eagle'
    elif ext == 'csv':
        return 'csv_bom'
    
    return None

def main():
    parser = argparse.ArgumentParser(description='Parse PCB Design Files')
    parser.add_argument('filepath', help='Path to the PCB file')
    args = parser.parse_args()
    
    if not os.path.exists(args.filepath):
        sys.stderr.write(f"Error: File not found {args.filepath}\n")
        sys.exit(1)
        
    filename = os.path.basename(args.filepath)
    file_type = detect_file_type(filename, args.filepath)
    
    log(f"Detected file type: {file_type} for {filename}")
    
    if not file_type:
        sys.stderr.write("Error: Unsupported file format\n")
        sys.exit(1)
        
    parsers = {
        'kicad': KiCadParser,
        'eagle': EagleParser,
        'altium': AltiumParser,
        'easyeda': EasyEDAParser,
        'pdf': PDFParser,
        'gerber': GerberParser,
        'ipc2581': IPC2581Parser,
        'odb': ODBPlusPlusParser,
        'orcad': OrCADNetlistParser
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
