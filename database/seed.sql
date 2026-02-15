-- Seed Data for Invictus Inventory Management System
-- Sample data for demonstration and testing

-- Insert default admin user (password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@electrolyte.com', '$2b$10$YpGxDJkzqHJHbQMqKQqQXOJmN6h5KxQKlG7Hv5FjZwCnRZqJvO4Wy', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert sample components
INSERT INTO components (component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category) VALUES
('10µF Capacitor', 'CAP-10UF-0805', 1000, 500, 0.15, '10µF Ceramic Capacitor 0805', 'Murata', '0805', 'Capacitors'),
('100nF Capacitor', 'CAP-100NF-0402', 2500, 1200, 0.05, '100nF Ceramic Capacitor 0402', 'Samsung', '0402', 'Capacitors'),
('1µF Capacitor', 'CAP-1UF-0603', 1500, 800, 0.08, '1µF Ceramic Capacitor 0603', 'TDK', '0603', 'Capacitors'),
('10K Resistor', 'RES-10K-0402', 3000, 1500, 0.02, '10K Ohm Resistor 0402', 'Yageo', '0402', 'Resistors'),
('4.7K Resistor', 'RES-4K7-0402', 2000, 1000, 0.02, '4.7K Ohm Resistor 0402', 'Yageo', '0402', 'Resistors'),
('100 Ohm Resistor', 'RES-100R-0603', 1800, 600, 0.03, '100 Ohm Resistor 0603', 'Vishay', '0603', 'Resistors'),
('STM32F103C8T6', 'IC-STM32F103', 200, 100, 3.50, 'ARM Cortex-M3 Microcontroller', 'STMicroelectronics', 'LQFP-48', 'ICs'),
('ESP32-WROOM-32', 'IC-ESP32-WROOM', 150, 80, 4.20, 'Wi-Fi+BT Module', 'Espressif', 'Module', 'ICs'),
('AMS1117-3.3', 'IC-AMS1117-33', 500, 200, 0.25, '3.3V LDO Voltage Regulator', 'AMS', 'SOT-223', 'ICs'),
('Red LED', 'LED-RED-0805', 3000, 500, 0.04, 'Red SMD LED 0805', 'Lite-On', '0805', 'LEDs'),
('Green LED', 'LED-GRN-0805', 2500, 400, 0.04, 'Green SMD LED 0805', 'Lite-On', '0805', 'LEDs'),
('USB Type-C Connector', 'CONN-USBC-SMD', 300, 150, 0.80, 'USB Type-C Female SMD', 'Amphenol', 'SMD', 'Connectors'),
('2.54mm Pin Header 40P', 'CONN-HDR-40P', 400, 200, 0.30, '40-Pin Male Header 2.54mm', 'Samtec', 'Through-Hole', 'Connectors'),
('Crystal 8MHz', 'XTAL-8MHZ', 300, 100, 0.50, '8MHz Crystal Oscillator', 'Abracon', 'HC49S', 'Passives'),
('22pF Capacitor', 'CAP-22PF-0402', 2000, 200, 0.03, '22pF Ceramic Capacitor 0402', 'Murata', '0402', 'Capacitors')
ON CONFLICT (part_number) DO NOTHING;

-- Insert sample PCB types
INSERT INTO pcb_types (pcb_name, pcb_code, description) VALUES
('STM32 Dev Board', 'PCB-STM32-DEV', 'STM32F103C8T6 Development Board'),
('ESP32 IoT Module', 'PCB-ESP32-IOT', 'ESP32-based IoT Sensor Module'),
('LED Driver Board', 'PCB-LED-DRV', 'Multi-channel LED Driver PCB'),
('Smart Thermostat Controller', 'PCB-SMART-THERM', 'Smart Home HVAC Controller'),
('Industrial Motor Drive', 'PCB-MOTOR-DRV', '3-Phase AC Motor Control Board'),
('LoRa Gateway', 'PCB-LORA-GTW', 'Long Range IoT Gateway Base Station'),
('High-Power Battery BMS', 'PCB-BMS-HIGH', 'Battery Management System for EV Power Packs'),
('Solar Inverter Board', 'PCB-SOLAR-INV', 'Grid-tie Solar Power Inverter Stage'),
('AI Voice Assistant Core', 'PCB-AI-VOICE', 'Embedded NLP and Audio Processing Unit'),
('Smart Lock Controller', 'PCB-LOCK-CTRL', 'Secure Bluetooth/NFC Door Entry System'),
('Medical Pulse Oximeter', 'PCB-MEDICAL-POX', 'High-Precision SpO2 Monitoring Board'),
('Agriculture Moisture Sensor', 'PCB-AGRI-MOIST', 'Soil Health and Moisture Monitoring Link'),
('Drone Flight Controller', 'PCB-DRONE-FC', 'Quadcopter Stabilization and Nav System'),
('Automotive OBD-II Reader', 'PCB-AUTO-OBD', 'Vehicle Diagnostics and CAN Bus Interface'),
('Zigbee Mesh Node', 'PCB-ZIGBEE-NODE', 'Wireless Mesh Network Client Device'),
('Audio DSP Processor', 'PCB-AUDIO-DSP', 'High-Fidelity Digital Audio Effects Processor'),
('High-Speed FPGA Buffer', 'PCB-FPGA-BUF', 'Data Acquisition and Signal Conditioning Board'),
('Wireless Power Transmitter', 'PCB-WLESS-PWR', 'Qi-Compatible Inductive Charging Base'),
('Industrial HMI Display', 'PCB-HMI-DISP', 'Touchscreen Interface and Machine Controller'),
('Smart Lighting Controller', 'PCB-LIGHT-CTRL', 'Dimmable LED Array and DALI/KNX Interface'),
('GPS Tracker Module', 'PCB-GPS-TRK', 'Low-Power Asset Tracking and Geo-fencing unit')
ON CONFLICT (pcb_code) DO NOTHING;

-- Insert PCB-Component Mappings (BOM)
-- PCB-STM32-DEV BOM
INSERT INTO pcb_components_mapping (pcb_id, component_id, quantity_per_unit) VALUES
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'CAP-10UF-0805'), 4),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 8),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'RES-10K-0402'), 6),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'IC-AMS1117-33'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'XTAL-8MHZ'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'CAP-22PF-0402'), 2),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'CONN-USBC-SMD'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'CONN-HDR-40P'), 2),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'LED-RED-0805'), 2),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-STM32-DEV'), (SELECT component_id FROM components WHERE part_number = 'LED-GRN-0805'), 1),

-- PCB-ESP32-IOT BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'CAP-10UF-0805'), 3),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 6),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'RES-10K-0402'), 4),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'RES-4K7-0402'), 2),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'IC-AMS1117-33'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'CONN-USBC-SMD'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ESP32-IOT'), (SELECT component_id FROM components WHERE part_number = 'LED-GRN-0805'), 2),

-- PCB-LED-DRV BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'LED-RED-0805'), 8),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'LED-GRN-0805'), 8),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'RES-100R-0603'), 16),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'CAP-1UF-0603'), 4),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 4),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LED-DRV'), (SELECT component_id FROM components WHERE part_number = 'CONN-HDR-40P'), 1),

-- PCB-SMART-THERM BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-SMART-THERM'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-SMART-THERM'), (SELECT component_id FROM components WHERE part_number = 'RES-10K-0402'), 4),

-- PCB-MOTOR-DRV BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-MOTOR-DRV'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-MOTOR-DRV'), (SELECT component_id FROM components WHERE part_number = 'CAP-10UF-0805'), 10),

-- PCB-LORA-GTW BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LORA-GTW'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LORA-GTW'), (SELECT component_id FROM components WHERE part_number = 'CONN-USBC-SMD'), 1),

-- PCB-BMS-HIGH BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-BMS-HIGH'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-BMS-HIGH'), (SELECT component_id FROM components WHERE part_number = 'RES-4K7-0402'), 20),

-- PCB-SOLAR-INV BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-SOLAR-INV'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-SOLAR-INV'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 15),

-- PCB-AI-VOICE BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AI-VOICE'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AI-VOICE'), (SELECT component_id FROM components WHERE part_number = 'CAP-10UF-0805'), 5),

-- PCB-LOCK-CTRL BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LOCK-CTRL'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LOCK-CTRL'), (SELECT component_id FROM components WHERE part_number = 'LED-RED-0805'), 1),

-- PCB-MEDICAL-POX BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-MEDICAL-POX'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-MEDICAL-POX'), (SELECT component_id FROM components WHERE part_number = 'LED-RED-0805'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-MEDICAL-POX'), (SELECT component_id FROM components WHERE part_number = 'LED-GRN-0805'), 1),

-- PCB-AGRI-MOIST BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AGRI-MOIST'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AGRI-MOIST'), (SELECT component_id FROM components WHERE part_number = 'RES-10K-0402'), 2),

-- PCB-DRONE-FC BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-DRONE-FC'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-DRONE-FC'), (SELECT component_id FROM components WHERE part_number = 'XTAL-8MHZ'), 1),

-- PCB-AUTO-OBD BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AUTO-OBD'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AUTO-OBD'), (SELECT component_id FROM components WHERE part_number = 'RES-100R-0603'), 4),

-- PCB-ZIGBEE-NODE BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ZIGBEE-NODE'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-ZIGBEE-NODE'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 3),

-- PCB-AUDIO-DSP BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AUDIO-DSP'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-AUDIO-DSP'), (SELECT component_id FROM components WHERE part_number = 'CAP-1UF-0603'), 10),

-- PCB-FPGA-BUF BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-FPGA-BUF'), (SELECT component_id FROM components WHERE part_number = 'CAP-100NF-0402'), 20),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-FPGA-BUF'), (SELECT component_id FROM components WHERE part_number = 'RES-100R-0603'), 50),

-- PCB-WLESS-PWR BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-WLESS-PWR'), (SELECT component_id FROM components WHERE part_number = 'IC-AMS1117-33'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-WLESS-PWR'), (SELECT component_id FROM components WHERE part_number = 'CAP-10UF-0805'), 2),

-- PCB-HMI-DISP BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-HMI-DISP'), (SELECT component_id FROM components WHERE part_number = 'IC-STM32F103'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-HMI-DISP'), (SELECT component_id FROM components WHERE part_number = 'CONN-HDR-40P'), 2),

-- PCB-LIGHT-CTRL BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LIGHT-CTRL'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-LIGHT-CTRL'), (SELECT component_id FROM components WHERE part_number = 'LED-GRN-0805'), 4),

-- PCB-GPS-TRK BOM
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-GPS-TRK'), (SELECT component_id FROM components WHERE part_number = 'IC-ESP32-WROOM'), 1),
((SELECT pcb_id FROM pcb_types WHERE pcb_code = 'PCB-GPS-TRK'), (SELECT component_id FROM components WHERE part_number = 'CAP-22PF-0402'), 2)
ON CONFLICT DO NOTHING;
