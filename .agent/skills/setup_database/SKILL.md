---
description: Set up or reset the PostgreSQL database schema for the Inventory Management System
---

# Setup PostgreSQL Database Skill

This skill allows you to quickly reset the database schema based on the provided `schema.sql`.

## Prerequisites

- PostgreSQL installed and running.
- `psql` command available in the PATH.
- `DATABASE_URL` environment variable set (optional, defaults to `postgres://postgres@localhost:5432/inventory_system`).

## Usage

1.  **Run the Setup Script**
    Execute the Python script `setup_db.py` to recreate tables. Or execute the SQL file directly using `psql`.

    ```bash
    python .agent/skills/setup_database/setup_db.py
    ```

    Or manually:

    ```bash
    psql -d inventory_system -f .agent/skills/setup_database/schema.sql
    ```

## Files

- `schema.sql`: Contains the database schema definition.
- `setup_db.py`: A Python script to connect and execute the schema.

## Notes

- This will **DROP** existing tables if specified in the script/SQL (currently `IF NOT EXISTS` is used, but for a full reset, you may need to add `DROP CASCADE` manually or update the script).
- Ensure the database `inventory_system` exists before running.
