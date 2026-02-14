---
description: Parse PCB files (KiCad, Eagle, Altium, PDF) and extract the Bill of Materials (BOM) in JSON format.
---

# PCB Parser Skill

This skill allows you to parse various PCB file formats (KiCad `.kicad_sch`, Eagle `.sch`, Altium `.SchDoc`, EasyEDA `.json`, and PDF BOMs) using the provided Python parsing logic.

## Usage

1.  **Execute the Parsing wrapper script**
    
    ```bash
    python .agent/skills/parse_pcb/parse_bom.py <path_to_pcb_file>
    ```

    Example:
    ```bash
    python .agent/skills/parse_pcb/parse_bom.py "d:\projects\my_pcb\schematic.kicad_sch"
    ```

2.  **Output**
    The script outputs a JSON string containing the extracted components and BOM list to stdout. You can pipe this to a file or process it directly.

## Requirements

- Python 3.8+
- Dependencies: `pdfplumber`, `pandas`, `flask` (as used by the underlying `app.py`).
- The original `app.py` script must be located at `antigravity_skills/antigravity_skills_scripts/app.py`.

## Files

- `parse_bom_wrapper.py`: A wrapper script that imports logic from `app.py` and runs it on a target file.

## Notes

- Ensure dependent libraries are installed using `pip install pdfplumber pandas flask openpyxl`.
