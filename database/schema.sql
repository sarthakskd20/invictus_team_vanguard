-- Invictus Inventory Management System
-- Database Schema for PostgreSQL 15+
-- Team Vanguard | Electrolyte Solutions Hackathon

-- 1. Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Components Table (Inventory)
-- CHECK constraint prevents negative stock at database level
CREATE TABLE IF NOT EXISTS components (
    component_id SERIAL PRIMARY KEY,
    component_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(255) UNIQUE NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    monthly_required_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) DEFAULT 0.00,
    description TEXT,
    manufacturer VARCHAR(255),
    footprint VARCHAR(255),
    category VARCHAR(100),
    mounting_type VARCHAR(10),
    tolerance VARCHAR(50),
    voltage_rating VARCHAR(50),
    min_threshold INTEGER DEFAULT 0,
    location VARCHAR(100),
    supplier VARCHAR(200),
    lead_time_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PCB Types Table (Product Templates)
CREATE TABLE IF NOT EXISTS pcb_types (
    pcb_id SERIAL PRIMARY KEY,
    pcb_name VARCHAR(255) NOT NULL,
    pcb_code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PCB Components Mapping (Bill of Materials)
CREATE TABLE IF NOT EXISTS pcb_components_mapping (
    mapping_id SERIAL PRIMARY KEY,
    pcb_id INTEGER NOT NULL REFERENCES pcb_types(pcb_id) ON DELETE CASCADE,
    component_id INTEGER NOT NULL REFERENCES components(component_id) ON DELETE RESTRICT,
    quantity_per_unit INTEGER NOT NULL CHECK (quantity_per_unit > 0),
    designators TEXT,
    dni BOOLEAN DEFAULT false,
    variant VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pcb_id, component_id)
);

-- 5. Production Entries Table
CREATE TABLE IF NOT EXISTS production_entries (
    entry_id SERIAL PRIMARY KEY,
    pcb_id INTEGER NOT NULL REFERENCES pcb_types(pcb_id),
    quantity_produced INTEGER NOT NULL CHECK (quantity_produced > 0),
    produced_by INTEGER REFERENCES users(user_id),
    production_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Component Transactions Table (CRITICAL - Immutable Audit Trail)
-- This table is APPEND-ONLY. No UPDATE or DELETE operations allowed.
CREATE TABLE IF NOT EXISTS component_transactions (
    transaction_id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(component_id),
    entry_id INTEGER REFERENCES production_entries(entry_id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEDUCTION', 'ADDITION', 'ADJUSTMENT', 'IMPORT')),
    quantity_changed INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Procurement Triggers Table (20% Threshold Alerts)
CREATE TABLE IF NOT EXISTS procurement_triggers (
    trigger_id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(component_id),
    current_stock INTEGER NOT NULL,
    threshold_quantity INTEGER NOT NULL,
    shortage_quantity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED')),
    acknowledged_by INTEGER REFERENCES users(user_id),
    acknowledged_at TIMESTAMP,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_components_part_number ON components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
CREATE INDEX IF NOT EXISTS idx_components_supplier ON components(supplier);
CREATE INDEX IF NOT EXISTS idx_components_mounting ON components(mounting_type);
CREATE INDEX IF NOT EXISTS idx_production_date ON production_entries(production_date);
CREATE INDEX IF NOT EXISTS idx_production_pcb ON production_entries(pcb_id);
CREATE INDEX IF NOT EXISTS idx_transactions_component ON component_transactions(component_id);
CREATE INDEX IF NOT EXISTS idx_transactions_entry ON component_transactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON component_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_status ON procurement_triggers(status);
CREATE INDEX IF NOT EXISTS idx_procurement_component ON procurement_triggers(component_id);
CREATE INDEX IF NOT EXISTS idx_pcb_mapping_pcb ON pcb_components_mapping(pcb_id);
CREATE INDEX IF NOT EXISTS idx_pcb_mapping_component ON pcb_components_mapping(component_id);
CREATE INDEX IF NOT EXISTS idx_bom_variant ON pcb_components_mapping(variant);

