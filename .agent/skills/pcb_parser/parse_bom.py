import sys
import os
import json
import argparse

# Add the directory containing app.py to sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'antigravity_skills', 'antigravity_skills_scripts')
sys.path.append(os.path.abspath(APP_DIR))

try:
    from app import get_parser, detect_file_type
except ImportError as e:
    print(f"Error importing app.py module: {e}")
    sys.exit(1)

def parse_pcb_file(filepath):
    """
    Parses a PCB file using the logic from `app.py` and returns a JSON string.
    """
    if not os.path.exists(filepath):
        return json.dumps({"error": f"File not found: {filepath}"}, indent=4)

    filename = os.path.basename(filepath)
    file_type = detect_file_type(filename)
    
    if not file_type:
        return json.dumps({"error": f"Unsupported file type: {filename}"}, indent=4)

    parser = get_parser(file_type, filepath)
    if not parser:
        return json.dumps({"error": "Parser not available"}, indent=4)

    if parser.parse():
        bom = parser.get_bom()
        return json.dumps({
            "success": True,
            "filename": filename,
            "type": file_type,
            "total_components": len(parser.components),
            "unique_parts": len(bom),
            "bom": bom, # The Bill of Materials list
            "components": parser.components # Raw component list
        }, indent=4)
    else:
        return json.dumps({"error": "Failed to parse file content"}, indent=4)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Parse PCB files and output JSON BOM.')
    parser.add_argument('filepath', help='Path to the PCB file (KiCad, Eagle, Altium, EasyEDA, PDF)')
    args = parser.parse_args()

    print(parse_pcb_file(args.filepath))
