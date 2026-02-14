const express = require('express');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve frontend

// Database Connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pcb_inventory',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// File Upload Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Ensure outputs directory exists
const outputDir = 'outputs';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', runtime: 'node.js' });
});

app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(outputDir, filename);
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filepath = req.file.path;
        const filename = req.file.originalname;
        const fileType = detectFileType(filename);

        if (!fileType) {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        const parser = getParser(fileType, filepath);
        if (!parser) {
            return res.status(400).json({ error: 'Parser not implemented yet' });
        }

        const result = await parser.parse();
        if (!result.success) {
            return res.status(500).json({ error: 'Parsing failed: ' + result.error });
        }

        // Generate BOM structure
        const bom = generateBOM(result.components);

        // Generate CSV and Excel
        const timestamp = Date.now();
        const csvFilename = `bom_${timestamp}.csv`;
        const excelFilename = `bom_${timestamp}.xlsx`;
        const csvPath = path.join(outputDir, csvFilename);
        const excelPath = path.join(outputDir, excelFilename);

        // CSV Generation
        const csvWriter = createCsvWriter({
            path: csvPath,
            header: [
                { id: 'designators', title: 'Designators' },
                { id: 'quantity', title: 'Qty' },
                { id: 'value', title: 'Value' },
                { id: 'footprint', title: 'Footprint' },
                { id: 'part_number', title: 'Part Number' },
                { id: 'description', title: 'Description' }
            ]
        });
        await csvWriter.writeRecords(bom);

        // Excel Generation
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('BOM');
        sheet.columns = [
            { header: 'Designators', key: 'designators', width: 30 },
            { header: 'Qty', key: 'quantity', width: 10 },
            { header: 'Value', key: 'value', width: 15 },
            { header: 'Footprint', key: 'footprint', width: 20 },
            { header: 'Part Number', key: 'part_number', width: 20 },
            { header: 'Description', key: 'description', width: 30 }
        ];
        sheet.addRows(bom);
        await workbook.xlsx.writeFile(excelPath);

        // Auto-Add to DB (Stock = 0)
        for (const item of bom) {
            // Note: generateBOM ensures part_number exists (standardized if needed)
            const query = `
                INSERT INTO components (part_number, value, footprint, stock_quantity, updated_at)
                VALUES ($1, $2, $3, 0, NOW())
                ON CONFLICT (part_number) DO NOTHING
            `;
            await pool.query(query, [item.part_number, item.value, item.footprint]);
        }

        res.json({
            success: true,
            file_type: fileType,
            components: result.components,
            bom: bom,
            total_components: result.components.length,
            unique_parts: bom.length,
            csv_file: csvFilename,
            excel_file: excelFilename
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const csv = require('csv-parser');

// ... (existing imports)

// Route: Upload Inventory (CSV/Excel)
app.post('/api/inventory', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filepath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let components = [];

    try {
        if (ext === '.csv') {
            await new Promise((resolve, reject) => {
                fs.createReadStream(filepath)
                    .pipe(csv())
                    .on('data', (row) => {
                        // Support various header names
                        const val = row.value || row['Value'];
                        const fp = row.footprint || row['Footprint'];
                        let pn = row.part_number || row['Part Number'] || row.mpn || row['MPN'];

                        // Smart Key Generation
                        if (!pn) {
                            pn = generateStandardKey(val, fp);
                        }

                        components.push({
                            part_number: pn,
                            value: val,
                            footprint: fp,
                            description: row.description || row['Description'],
                            quantity: (function (val) {
                                const parsed = parseInt(val);
                                return isNaN(parsed) ? 0 : parsed;
                            })(row.quantity || row['Stock Quantity'] || row.stock || row['Stock'])
                        });
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filepath);
            const sheet = workbook.getWorksheet(1);

            // detect header row
            const headerRow = sheet.getRow(1).values;
            // Map columns based on our export format: 
            // 1:Part Number, 2:Value, 3:Stock Quantity, 4:Description, 5:Footprint
            // But we should try to be dynamic if possible, or stick to refined assumption.
            // Let's assume standard export format usage.

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // skip header

                const pn = row.getCell(1).value;
                const val = row.getCell(2).value;
                const qty = row.getCell(3).value;
                const desc = row.getCell(4).value;
                const fp = row.getCell(5).value;

                let partNumber = pn;
                if (!partNumber) {
                    partNumber = generateStandardKey(val, fp);
                }

                components.push({
                    part_number: partNumber,
                    value: val,
                    footprint: fp,
                    quantity: (function (val) {
                        const parsed = parseInt(val);
                        return isNaN(parsed) ? 0 : parsed;
                    })(qty)
                });
            });
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Use CSV or Excel.' });
        }

        // Upsert into Database
        let updatedCount = 0;
        for (const comp of components) {
            if (!comp.part_number) continue;

            const query = `
                INSERT INTO components (part_number, value, footprint, stock_quantity, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (part_number) 
                DO UPDATE SET 
                    stock_quantity = EXCLUDED.stock_quantity, 
                    value = COALESCE(EXCLUDED.value, components.value),
                    footprint = COALESCE(EXCLUDED.footprint, components.footprint),
                    updated_at = NOW()
            `;
            // Note: Update value/footprint if provided? Yes, keep it fresh.
            await pool.query(query, [comp.part_number, comp.value, comp.footprint, comp.quantity]);
            updatedCount++;
        }

        res.json({ success: true, message: `Inventory updated. Processed ${updatedCount} items.` });

    } catch (error) {
        console.error('Inventory Upload Error:', error);
        res.status(500).json({ error: 'Failed to process inventory file' });
    }
});

// Route: Deduct Stock based on BOM
app.post('/api/deduct', async (req, res) => {
    const { bom } = req.body;

    if (!bom || !Array.isArray(bom)) {
        return res.status(400).json({ error: 'Invalid BOM data' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let report = [];

        for (const item of bom) {
            let partNum = item.part_number;
            const qtyNeeded = item.quantity;
            const value = item.value || '';
            const footprint = item.footprint || '';
            const description = item.description || '';

            // Strategy 1: Exact Match
            let checkRes = await client.query('SELECT part_number, stock_quantity FROM components WHERE part_number = $1', [partNum]);

            // Strategy 2: Standard Key Match (Value + Footprint)
            if (checkRes.rows.length === 0 && value && footprint) {
                const standardKey = generateStandardKey(value, footprint);
                checkRes = await client.query('SELECT part_number, stock_quantity FROM components WHERE part_number = $1', [standardKey]);
            }

            // Strategy 3: Aggressive Substring Match (BOM Name contains Inventory Name)
            // Strategy 3: Aggressive Substring Match (BOM Name contains Inventory Name)
            if (checkRes.rows.length === 0) {
                const searchTerm = partNum || value || description;

                if (searchTerm && searchTerm.length > 2) {
                    const fuzzyQuery = `
                        SELECT part_number, stock_quantity 
                        FROM components 
                        WHERE length(part_number) > 2 
                        AND $1 ILIKE '%' || part_number || '%'
                        ORDER BY length(part_number) DESC 
                        LIMIT 1
                     `;
                    checkRes = await client.query(fuzzyQuery, [searchTerm]);
                }
            }

            if (checkRes.rows.length > 0) {
                // Match Found
                partNum = checkRes.rows[0].part_number; // Update to the matched DB part number
                const currentStock = checkRes.rows[0].stock_quantity;

                if (currentStock >= qtyNeeded) {
                    await client.query('UPDATE components SET stock_quantity = stock_quantity - $1 WHERE part_number = $2', [qtyNeeded, partNum]);
                    report.push({ part: partNum, status: 'Deducted', original_bom_part: item.part_number, remaining: currentStock - qtyNeeded });
                } else {
                    report.push({ part: partNum, status: 'Insufficient Stock', stock: currentStock, needed: qtyNeeded });
                }
            } else {
                // No Match -> Add to DB with 0 Stock (Standard Key)
                if (!partNum) partNum = generateStandardKey(value, footprint);

                await client.query(`
                    INSERT INTO components (part_number, value, footprint, stock_quantity, updated_at)
                    VALUES ($1, $2, $3, 0, NOW())
                    ON CONFLICT (part_number) DO NOTHING
                `, [partNum, value, footprint]);

                report.push({ part: partNum, status: 'Not Found - Added to Inventory (0 Stock)', needed: qtyNeeded });
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, report: report });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Deduction Error:', error);
        res.status(500).json({ error: 'Transaction failed' });
    } finally {
        client.release();
    }
});
// Route: Get All Inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM components ORDER BY part_number ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Inventory Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Route: Export Inventory
app.get('/api/inventory/export/:type', async (req, res) => {
    const type = req.params.type;
    const filename = `inventory_${Date.now()}.${type === 'excel' ? 'xlsx' : 'csv'}`;
    const filepath = path.join(outputDir, filename);

    try {
        const result = await pool.query('SELECT * FROM components ORDER BY part_number ASC');
        const components = result.rows;

        if (type === 'csv') {
            const csvWriter = createCsvWriter({
                path: filepath,
                header: [
                    { id: 'part_number', title: 'Part Number' },
                    { id: 'value', title: 'Value' },
                    { id: 'stock_quantity', title: 'Stock Quantity' },
                    { id: 'description', title: 'Description' },
                    { id: 'footprint', title: 'Footprint' },
                    { id: 'manufacturer', title: 'Manufacturer' }
                ]
            });
            await csvWriter.writeRecords(components);
        } else if (type === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Inventory');
            sheet.columns = [
                { header: 'Part Number', key: 'part_number', width: 20 },
                { header: 'Value', key: 'value', width: 15 },
                { header: 'Stock Quantity', key: 'stock_quantity', width: 15 },
                { header: 'Description', key: 'description', width: 30 },
                { header: 'Footprint', key: 'footprint', width: 20 },
                { header: 'Manufacturer', key: 'manufacturer', width: 20 }
            ];
            sheet.addRows(components);
            await workbook.xlsx.writeFile(filepath);
        } else {
            return res.status(400).json({ error: 'Invalid export type' });
        }

        res.json({ success: true, file: filename });

    } catch (err) {
        console.error('Inventory Export Error:', err);
        res.status(500).json({ error: 'Failed to export inventory' });
    }
});

app.post('/api/bom/export/:type', async (resBody, res) => {
    try {
        const { type } = resBody.params;
        const { bom } = resBody.body; // Expect BOM list in body

        if (!bom || !Array.isArray(bom)) {
            return res.status(400).json({ error: 'No BOM data provided' });
        }

        const filename = `bom_export_${Date.now()}.${type === 'csv' ? 'csv' : 'xlsx'}`;
        const filepath = path.join(exportsDir, filename);

        if (type === 'csv') {
            const csvWriter = createCsvWriter({
                path: filepath,
                header: [
                    { id: 'part_number', title: 'Part Number' },
                    { id: 'quantity', title: 'Quantity' },
                    { id: 'value', title: 'Value' },
                    { id: 'footprint', title: 'Footprint' },
                    { id: 'designators', title: 'Designators' },
                    { id: 'description', title: 'Description' }
                ]
            });
            await csvWriter.writeRecords(bom);
        } else if (type === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('BOM');
            sheet.columns = [
                { header: 'Part Number', key: 'part_number', width: 20 },
                { header: 'Quantity', key: 'quantity', width: 10 },
                { header: 'Value', key: 'value', width: 15 },
                { header: 'Footprint', key: 'footprint', width: 20 },
                { header: 'Designators', key: 'designators', width: 30 },
                { header: 'Description', key: 'description', width: 30 }
            ];
            sheet.addRows(bom);
            await workbook.xlsx.writeFile(filepath);
        }

        res.json({ success: true, file: filename });
    } catch (err) {
        console.error('BOM Export Error:', err);
        res.status(500).json({ error: 'Failed to export BOM' });
    }
});

// Helper: Generate Standard Key
function generateStandardKey(value, footprint) {
    const v = (value || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const f = (footprint || 'UNK').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `${v}_${f}`;
}

function detectFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.kicad_sch' || (ext === '.sch' && filename.toLowerCase().includes('kicad'))) return 'kicad';
    if (ext === '.sch') return 'eagle';
    if (ext === '.schdoc') return 'altium';
    if (ext === '.json') return 'easyeda';
    if (ext === '.pdf') return 'pdf';
    return null;
}

function getParser(fileType, filepath) {
    // Lazy load parsers
    const parsers = {
        'kicad': require('./parsers/kicad'),
        'eagle': require('./parsers/eagle'),
        'altium': require('./parsers/altium'),
        'easyeda': require('./parsers/easyeda'),
        'pdf': require('./parsers/pdf')
    };
    const ParserClass = parsers[fileType];
    return ParserClass ? new ParserClass(filepath) : null;
}

function generateBOM(components) {
    const bomMap = new Map();

    components.forEach(comp => {
        // Create a unique key based on value, footprint, part_number
        // ENHANCEMENT: Use generated key if part_number is missing
        let partNumber = comp.part_number;
        if (!partNumber || partNumber === 'undefined') {
            partNumber = generateStandardKey(comp.value, comp.footprint);
        }

        // Pass standard part number back to object
        comp.part_number = partNumber;

        const key = partNumber;

        if (!bomMap.has(key)) {
            bomMap.set(key, {
                designators: [],
                value: comp.value || '',
                footprint: comp.footprint || '',
                part_number: partNumber,
                description: comp.description || '',
                quantity: 0
            });
        }

        const entry = bomMap.get(key);
        entry.designators.push(comp.reference);
        entry.quantity++;
    });

    return Array.from(bomMap.values()).map(item => ({
        ...item,
        designators: item.designators.sort().join(', ')
    })).sort((a, b) => a.designators.localeCompare(b.designators));
}

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);

    // Check DB connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection failed:', err.message);
        } else {
            console.log('Database connected:', res.rows[0].now);
        }
    });
});
