import random
import psycopg2
import uuid
from datetime import datetime, timedelta
# Import faker if available, otherwise use simple functions
try:
    from faker import Faker
    fake = Faker()
except ImportError:
    fake = None
    import string
    import random
    
    class Faker:
        def __init__(self):
            pass
        
        def catch_phrase(self):
            return "Sample Component"

    fake = Faker()

def generate_part_number():
    prefix = random.choice(['RES', 'CAP', 'IND', 'IC', 'CONN', 'DIO', 'TRA', 'X', 'Y', 'W'])
    return f"{prefix}-{random.randint(1000, 9999)}"

def generate_component_name():
    return fake.bs() if hasattr(fake, 'bs') else f"Component {random.randint(1, 100)}"

# Database setup
DATABASE_URL = "postgres://postgres:postgres@localhost:5432/inventory_system"

def main():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Insert Components
        print("Inserting components...")
        component_ids = []
        for _ in range(50):
            comp_id = str(uuid.uuid4())
            name = generate_component_name()
            part_number = generate_part_number()
            stock_qty = random.randint(0, 5000)
            monthly_req = random.randint(100, 1000)
            
            cur.execute("""
                INSERT INTO components (id, name, part_number, stock_quantity, monthly_required_quantity)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (comp_id, name, part_number, stock_qty, monthly_req))
            component_ids.append(cur.fetchone()[0])
            
        # Insert PCBs
        print("Inserting PCBs...")
        pcb_ids = []
        for _ in range(10):
            pcb_id = str(uuid.uuid4())
            name = f"PCB-{random.randint(100, 999)} {fake.bs()}"
            description = fake.text()
            
            cur.execute("""
                INSERT INTO pcbs (id, name, description)
                VALUES (%s, %s, %s)
                RETURNING id;
            """, (pcb_id, name, description))
            pcb_ids.append(cur.fetchone()[0])
            
        # Map Components to PCBs (create BOM)
        print("Creating BOM mappings...")
        for pcb_id in pcb_ids:
            num_components = random.randint(5, 15)
            selected_comps = random.sample(component_ids, num_components)
            
            for comp_id in selected_comps:
                qty = random.randint(1, 10)
                cur.execute("""
                    INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING;
                """, (pcb_id, comp_id, qty))
                
        # Generate Production History
        print("Generating production logs...")
        start_date = datetime.now() - timedelta(days=180)
        for _ in range(100):
            pcb_id = random.choice(pcb_ids)
            qty_produced = random.randint(1, 50)
            prod_date = start_date + timedelta(days=random.randint(0, 180))
            
            cur.execute("""
                INSERT INTO production_logs (pcb_id, quantity_produced, production_date)
                VALUES (%s, %s, %s);
            """, (pcb_id, qty_produced, prod_date))
            
            # (Optional) Update stock logic could be simulated here, but this is mock data generation
            
        conn.commit()
        print("✅ Mock data generation complete.")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    main()
