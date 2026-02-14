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

        // TODO: Save to DB (Deferred)

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

// Helper Functions
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
        const key = `${comp.value || ''}|${comp.footprint || ''}|${comp.part_number || ''}`;

        if (!bomMap.has(key)) {
            bomMap.set(key, {
                designators: [],
                value: comp.value || '',
                footprint: comp.footprint || '',
                part_number: comp.part_number || '',
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
