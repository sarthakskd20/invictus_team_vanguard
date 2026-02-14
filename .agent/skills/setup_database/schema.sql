-- Database Schema for Inventory Automation System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Admin Role)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Components Table
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    part_number VARCHAR(50) UNIQUE NOT NULL,
    manufacturer VARCHAR(100),
    description TEXT,
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    monthly_required_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER GENERATED ALWAYS AS (monthly_required_quantity * 0.2) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PCBs Table
CREATE TABLE IF NOT EXISTS pcbs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PCB Components Mapping (BOM)
CREATE TABLE IF NOT EXISTS pcb_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pcb_id UUID REFERENCES pcbs(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    quantity_per_pcb INTEGER NOT NULL CHECK (quantity_per_pcb > 0),
    UNIQUE(pcb_id, component_id)
);

-- Production Logs (Consumption History)
CREATE TABLE IF NOT EXISTS production_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pcb_id UUID REFERENCES pcbs(id) ON DELETE SET NULL,
    quantity_produced INTEGER NOT NULL CHECK (quantity_produced > 0),
    production_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Procurement Triggers (Generated automatically via trigger or app logic)
CREATE TABLE IF NOT EXISTS procurement_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    trigger_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, ordered, received
    required_quantity INTEGER
);

-- Trigger to maintain updated_at on components
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
