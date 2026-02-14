---
description: Populate the database with mock data for components, PCBs, and consumption history.
---

# Generate Mock Data Skill

This skill populates the PostgreSQL database with random but realistic data to test the Analytics Dashboard and other features.

## Usage

1.  **Run the script**
    
    ```bash
    python .agent/skills/generate_mock_data/generate_mock.py
    ```

## Files

- `generate_mock.py`: Python script connecting to the database and inserting:
  - 50+ components with realistic names and part numbers.
  - 10+ PCBs with varying component mappings.
  - Production logs spanning the last 6 months.

## Notes

- This script requires `faker` and `psycopg2` or `pg8000`.
