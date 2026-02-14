import os
import sys
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/inventory_system')

def setup_database():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Read the schema file
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        if not os.path.exists(schema_path):
            print(f"Schema file not found at {schema_path}")
            sys.exit(1)
            
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
            
        # Execute the SQL
        cursor.execute(schema_sql)
        conn.commit()
        
        print("✅ Database schema initialized successfully.")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        sys.exit(1)
    finally:
        if conn:
            cursor.close()
            conn.close()

if __name__ == "__main__":
    setup_database()
