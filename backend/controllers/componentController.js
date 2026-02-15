const { pool } = require('../config/database');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parseExcel } = require('../utils/sheetParser');

// GET all components
const getAllComponents = async (req, res, next) => {
    try {
        const { search, category, sort, order } = req.query;
        let query = 'SELECT * FROM components';
        const params = [];
        const conditions = [];

        if (search) {
            conditions.push(`(component_name ILIKE $${params.length + 1} OR part_number ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }

        if (category) {
            conditions.push(`category = $${params.length + 1}`);
            params.push(category);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const sortCol = ['component_name', 'part_number', 'current_stock', 'category', 'created_at'].includes(sort) ? sort : 'component_name';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${sortCol} ${sortOrder}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET single component
const getComponentById = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM components WHERE component_id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
};

// POST create component
const createComponent = async (req, res, next) => {
    try {
        const { component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category } = req.body;

        if (!component_name || !part_number) {
            return res.status(400).json({ error: 'Component name and part number are required.' });
        }

        const result = await pool.query(
            `INSERT INTO components (component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [component_name, part_number, current_stock || 0, monthly_required_quantity || 0, unit_price || 0, description, manufacturer, footprint, category]
        );

        // Log the addition transaction
        if (current_stock && current_stock > 0) {
            await pool.query(
                `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note)
         VALUES ($1, 'ADDITION', $2, 0, $2, 'Initial stock on creation')`,
                [result.rows[0].component_id, current_stock]
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
};

// PUT update component (Transaction-safe with row-level locking)
const updateComponent = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category } = req.body;
        const componentId = req.params.id;

        await client.query('BEGIN');

        // Lock the component row to prevent concurrent modifications
        const current = await client.query(
            'SELECT current_stock FROM components WHERE component_id = $1 FOR UPDATE',
            [componentId]
        );
        if (current.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found.' });
        }

        const oldStock = current.rows[0].current_stock;

        const result = await client.query(
            `UPDATE components SET
        component_name = COALESCE($1, component_name),
        part_number = COALESCE($2, part_number),
        current_stock = COALESCE($3, current_stock),
        monthly_required_quantity = COALESCE($4, monthly_required_quantity),
        unit_price = COALESCE($5, unit_price),
        description = COALESCE($6, description),
        manufacturer = COALESCE($7, manufacturer),
        footprint = COALESCE($8, footprint),
        category = COALESCE($9, category),
        updated_at = CURRENT_TIMESTAMP
       WHERE component_id = $10
       RETURNING *`,
            [component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category, componentId]
        );

        // Log stock adjustment if stock changed
        if (current_stock !== undefined && current_stock !== oldStock) {
            await client.query(
                `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note)
         VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'Manual stock adjustment')`,
                [componentId, current_stock - oldStock, oldStock, current_stock]
            );
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');

        // Handle check constraint violation (negative stock)
        if (err.code === '23514') {
            return res.status(400).json({
                error: 'Stock constraint violation',
                message: 'Cannot set stock to a negative value.'
            });
        }
        next(err);
    } finally {
        client.release();
    }
};

// DELETE component
const deleteComponent = async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM components WHERE component_id = $1 RETURNING component_id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found.' });
        }
        res.json({ message: 'Component deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

// POST import from Excel/CSV
const importComponents = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filepath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let components = [];
    let importedCount = 0;
    let skippedCount = 0;

    try {
        if (ext === '.csv') {
            components = await new Promise((resolve, reject) => {
                const rows = [];
                fs.createReadStream(filepath)
                    .pipe(csv())
                    .on('data', (row) => {
                        rows.push({
                            component_name: row['Component Name'] || row['component_name'] || row['Name'] || '',
                            part_number: row['Part Number'] || row['part_number'] || row['MPN'] || '',
                            current_stock: parseInt(row['Current Stock'] || row['current_stock'] || row['Stock'] || row['Quantity'] || '0') || 0,
                            monthly_required_quantity: parseInt(row['Monthly Required'] || row['monthly_required_quantity'] || '0') || 0,
                            unit_price: parseFloat(row['Unit Price'] || row['unit_price'] || row['Price'] || '0') || 0,
                            description: row['Description'] || row['description'] || '',
                            manufacturer: row['Manufacturer'] || row['manufacturer'] || '',
                            footprint: row['Footprint'] || row['footprint'] || '',
                            category: row['Category'] || row['category'] || ''
                        });
                    })
                    .on('end', () => resolve(rows))
                    .on('error', reject);
            });
        } else if (ext === '.xlsx' || ext === '.xls') {
            try {
                components = await parseExcel(filepath);

                // Validate parsed components
                components = components.filter(c => c.part_number || c.component_name);

                if (components.length === 0) {
                    // Fallback check or just proceed (will result in 0 imported)
                    console.log("No components found in Excel import");
                }
            } catch (parseErr) {
                return res.status(400).json({ error: 'Failed to parse Excel file: ' + parseErr.message });
            }
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Use CSV or Excel (.xlsx).' });
        }

        // Upsert components
        for (const comp of components) {
            if (!comp.part_number) {
                skippedCount++;
                continue;
            }

            // Check if exists
            const existing = await pool.query('SELECT component_id, current_stock FROM components WHERE part_number = $1', [comp.part_number]);

            if (existing.rows.length > 0) {
                const oldStock = existing.rows[0].current_stock;
                await pool.query(
                    `UPDATE components SET
            component_name = COALESCE(NULLIF($1, ''), component_name),
            current_stock = $2,
            monthly_required_quantity = COALESCE(NULLIF($3::text, '0')::integer, monthly_required_quantity),
            unit_price = COALESCE(NULLIF($4::text, '0')::decimal, unit_price),
            description = COALESCE(NULLIF($5, ''), description),
            manufacturer = COALESCE(NULLIF($6, ''), manufacturer),
            footprint = COALESCE(NULLIF($7, ''), footprint),
            category = COALESCE(NULLIF($8, ''), category),
            updated_at = CURRENT_TIMESTAMP
           WHERE part_number = $9`,
                    [comp.component_name, comp.current_stock, comp.monthly_required_quantity, comp.unit_price, comp.description, comp.manufacturer, comp.footprint, comp.category, comp.part_number]
                );

                if (comp.current_stock !== oldStock) {
                    await pool.query(
                        `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note)
             VALUES ($1, 'IMPORT', $2, $3, $4, 'Excel/CSV import update')`,
                        [existing.rows[0].component_id, comp.current_stock - oldStock, oldStock, comp.current_stock]
                    );
                }
            } else {
                const insertResult = await pool.query(
                    `INSERT INTO components (component_name, part_number, current_stock, monthly_required_quantity, unit_price, description, manufacturer, footprint, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING component_id`,
                    [comp.component_name, comp.part_number, comp.current_stock, comp.monthly_required_quantity, comp.unit_price, comp.description, comp.manufacturer, comp.footprint, comp.category]
                );

                if (comp.current_stock > 0) {
                    await pool.query(
                        `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note)
             VALUES ($1, 'IMPORT', $2, 0, $2, 'Excel/CSV import - new component')`,
                        [insertResult.rows[0].component_id, comp.current_stock]
                    );
                }
            }
            importedCount++;
        }

        // Cleanup uploaded file
        fs.unlinkSync(filepath);

        res.json({
            message: `Import complete. ${importedCount} components processed, ${skippedCount} skipped.`,
            imported: importedCount,
            skipped: skippedCount
        });
    } catch (err) {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        next(err);
    }
};

// GET export components to Excel
const exportComponents = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM components ORDER BY component_name ASC');

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inventory');

        sheet.columns = [
            { header: 'Part Number', key: 'part_number', width: 22 },
            { header: 'Component Name', key: 'component_name', width: 28 },
            { header: 'Current Stock', key: 'current_stock', width: 14 },
            { header: 'Monthly Required', key: 'monthly_required_quantity', width: 16 },
            { header: 'Unit Price', key: 'unit_price', width: 12 },
            { header: 'Category', key: 'category', width: 14 },
            { header: 'Manufacturer', key: 'manufacturer', width: 18 },
            { header: 'Footprint', key: 'footprint', width: 14 },
            { header: 'Description', key: 'description', width: 30 }
        ];

        // Style header row
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inventory_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

// GET categories
const getCategories = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT DISTINCT category FROM components WHERE category IS NOT NULL AND category != \'\' ORDER BY category');
        res.json(result.rows.map(r => r.category));
    } catch (err) {
        next(err);
    }
};

// POST import schematic (Parse & Preview only)
const importSchematic = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filepath = req.file.path;
    const scriptPath = path.join(__dirname, '../scripts/parse_pcb.py');

    // Spawn Python process
    const pythonProcess = spawn('python', [scriptPath, filepath]);

    let dataString = '';
    let errorString = '';

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return res.status(500).json({ error: 'Failed to execute parser script. Is Python installed and in PATH?', details: err.message });
    });

    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
        // Don't log basic info messages as errors
        if (!data.toString().includes('[INFO]')) {
            console.error(`Python Stderr: ${data}`);
        }
    });

    pythonProcess.on('close', async (code) => {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

        if (code !== 0) {
            return res.status(500).json({
                error: 'Failed to parse schematic file.',
                details: errorString
            });
        }

        try {
            const result = JSON.parse(dataString);

            if (!result.success) {
                return res.status(400).json({ error: 'Parsing failed', details: result });
            }

            // Process BOM items for Preview
            const bom = result.bom;
            const previewComponents = [];

            for (const item of bom) {
                // Determine Part Number
                let partNumber = item.part_number;
                let compName = item.value || item.description || 'Unknown Component';

                if (!partNumber || partNumber === 'N/A') {
                    // Heuristic
                    if (compName && compName.length > 3 && /^[A-Z0-9-]+$/.test(compName)) {
                        partNumber = compName;
                    } else {
                        // Still include in preview but mark as 'invalid_pn' or similar?
                        // Or just skip for now as per previous logic
                        continue;
                    }
                }

                // Check existence
                const existing = await pool.query('SELECT component_id, current_stock, component_name, manufacturer, footprint, description FROM components WHERE part_number = $1', [partNumber]);

                if (existing.rows.length > 0) {
                    const curr = existing.rows[0];
                    previewComponents.push({
                        part_number: partNumber,
                        component_name: compName,
                        category: item.category || 'Uncategorized',
                        manufacturer: item.manufacturer || '',
                        footprint: item.footprint || '',
                        description: item.description || '',
                        quantity: item.quantity || 1,
                        status: 'existing',
                        current_db_data: curr,
                        monthly_required_quantity: 0
                    });
                } else {
                    previewComponents.push({
                        part_number: partNumber,
                        component_name: compName,
                        category: item.category || 'Uncategorized',
                        manufacturer: item.manufacturer || '',
                        footprint: item.footprint || '',
                        description: item.description || '',
                        quantity: item.quantity || 1,
                        status: 'new',
                        current_db_data: null,
                        monthly_required_quantity: 0
                    });
                }
            }

            res.json({
                message: 'Schematic parsed successfully.',
                preview: previewComponents,
                total_found: previewComponents.length
            });

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to process parsed data.', details: e.message });
        }
    });
};

// POST batch upsert components (Confirm Import)
const batchUpsertComponents = async (req, res, next) => {
    const { components } = req.body; // Array of component objects
    if (!components || !Array.isArray(components)) {
        return res.status(400).json({ error: 'Invalid data format. Expected array of components in "components" field.' });
    }

    let added = 0;
    let updated = 0;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check which enterprise columns exist (in case migration hasn't run)
        const colCheck = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'components' AND column_name IN ('mounting_type', 'tolerance', 'voltage_rating', 'supplier', 'location')"
        );
        const existingCols = new Set(colCheck.rows.map(r => r.column_name));
        const hasEnterprise = existingCols.has('mounting_type');

        for (const comp of components) {
            const existing = await client.query('SELECT component_id FROM components WHERE part_number = $1', [comp.part_number]);

            // Use provided category or default
            const category = comp.category || 'Uncategorized';

            if (existing.rows.length > 0) {
                const importQty = parseInt(comp.quantity) || 0;
                if (hasEnterprise) {
                    await client.query(
                        `UPDATE components SET
                        component_name = COALESCE(NULLIF($1, 'N/A'), component_name),
                        description = COALESCE(NULLIF($2, 'N/A'), description),
                        footprint = COALESCE(NULLIF($3, 'N/A'), footprint),
                        manufacturer = COALESCE(NULLIF($4, 'N/A'), manufacturer),
                        category = COALESCE(NULLIF($6, 'Uncategorized'), category),
                        mounting_type = COALESCE($7, mounting_type),
                        tolerance = COALESCE($8, tolerance),
                        voltage_rating = COALESCE($9, voltage_rating),
                        supplier = COALESCE($10, supplier),
                        location = COALESCE($11, location),
                        current_stock = current_stock + $12,
                        updated_at = CURRENT_TIMESTAMP
                        WHERE part_number = $5`,
                        [comp.component_name, comp.description, comp.footprint, comp.manufacturer, comp.part_number, category,
                        comp.mounting_type || null, comp.tolerance || null, comp.voltage_rating || null, comp.supplier || null, comp.location || null, importQty]
                    );
                } else {
                    await client.query(
                        `UPDATE components SET
                        component_name = COALESCE(NULLIF($1, 'N/A'), component_name),
                        description = COALESCE(NULLIF($2, 'N/A'), description),
                        footprint = COALESCE(NULLIF($3, 'N/A'), footprint),
                        manufacturer = COALESCE(NULLIF($4, 'N/A'), manufacturer),
                        category = COALESCE(NULLIF($6, 'Uncategorized'), category),
                        current_stock = current_stock + $7,
                        updated_at = CURRENT_TIMESTAMP
                        WHERE part_number = $5`,
                        [comp.component_name, comp.description, comp.footprint, comp.manufacturer, comp.part_number, category, importQty]
                    );
                }
                updated++;
            } else {
                const importQty = parseInt(comp.quantity) || 0;
                if (hasEnterprise) {
                    await client.query(
                        `INSERT INTO components (component_name, part_number, current_stock, unit_price, description, manufacturer, footprint, category, monthly_required_quantity, mounting_type, tolerance, voltage_rating, supplier, location)
                        VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                        [comp.component_name, comp.part_number, importQty, comp.description, comp.manufacturer, comp.footprint, category, comp.monthly_required_quantity || 0,
                        comp.mounting_type || null, comp.tolerance || null, comp.voltage_rating || null, comp.supplier || null, comp.location || null]
                    );
                } else {
                    await client.query(
                        `INSERT INTO components (component_name, part_number, current_stock, unit_price, description, manufacturer, footprint, category, monthly_required_quantity)
                        VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8)`,
                        [comp.component_name, comp.part_number, importQty, comp.description, comp.manufacturer, comp.footprint, category, comp.monthly_required_quantity || 0]
                    );
                }
                added++;
            }
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Import confirmed. Added ${added}, Updated ${updated} components.`,
            added,
            updated
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};



module.exports = {
    getAllComponents,
    getComponentById,
    createComponent,
    updateComponent,
    deleteComponent,
    importComponents,
    exportComponents,
    getCategories,
    importSchematic,
    batchUpsertComponents
};
