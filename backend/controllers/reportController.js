const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

// GET export inventory snapshot
const exportInventory = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT c.*,
        CASE WHEN monthly_required_quantity > 0
          THEN ROUND((current_stock::decimal / monthly_required_quantity) * 100, 1)
          ELSE 100
        END as stock_health_percentage
      FROM components c ORDER BY component_name
    `);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inventory Snapshot');

        sheet.columns = [
            { header: 'Part Number', key: 'part_number', width: 22 },
            { header: 'Component Name', key: 'component_name', width: 28 },
            { header: 'Current Stock', key: 'current_stock', width: 14 },
            { header: 'Monthly Required', key: 'monthly_required_quantity', width: 16 },
            { header: 'Stock Health %', key: 'stock_health_percentage', width: 14 },
            { header: 'Unit Price', key: 'unit_price', width: 12 },
            { header: 'Category', key: 'category', width: 14 },
            { header: 'Manufacturer', key: 'manufacturer', width: 18 },
            { header: 'Description', key: 'description', width: 30 }
        ];

        sheet.getRow(1).font = { bold: true };
        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inventory_snapshot_${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

// GET export consumption report
const exportConsumption = async (req, res, next) => {
    try {
        const { start_date, end_date } = req.query;

        let query = `
      SELECT ct.created_at, ct.transaction_type, ct.quantity_changed,
             ct.balance_before, ct.balance_after, ct.reference_note,
             c.component_name, c.part_number
      FROM component_transactions ct
      JOIN components c ON ct.component_id = c.component_id
      WHERE ct.transaction_type = 'DEDUCTION'
    `;
        const params = [];

        if (start_date) {
            params.push(start_date);
            query += ` AND ct.created_at::date >= $${params.length}`;
        }
        if (end_date) {
            params.push(end_date);
            query += ` AND ct.created_at::date <= $${params.length}`;
        }

        query += ' ORDER BY ct.created_at DESC';

        const result = await pool.query(query, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Consumption Report');

        sheet.columns = [
            { header: 'Date', key: 'created_at', width: 20 },
            { header: 'Part Number', key: 'part_number', width: 22 },
            { header: 'Component', key: 'component_name', width: 28 },
            { header: 'Quantity Used', key: 'quantity_changed', width: 14 },
            { header: 'Stock Before', key: 'balance_before', width: 14 },
            { header: 'Stock After', key: 'balance_after', width: 14 },
            { header: 'Reference', key: 'reference_note', width: 30 }
        ];

        sheet.getRow(1).font = { bold: true };
        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=consumption_report_${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

// GET transaction history for a component
const getTransactionHistory = async (req, res, next) => {
    try {
        const componentId = req.params.componentId;
        const result = await pool.query(`
      SELECT ct.*, c.component_name, c.part_number
      FROM component_transactions ct
      JOIN components c ON ct.component_id = c.component_id
      WHERE ct.component_id = $1
      ORDER BY ct.created_at DESC
    `, [componentId]);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET export standardized BOM Excel for a PCB type with production scaling
const exportBOM = async (req, res, next) => {
    try {
        const pcbId = req.params.pcbId;
        const buildQty = parseInt(req.query.buildQty) || 1;

        // Get PCB info
        const pcbResult = await pool.query('SELECT * FROM pcb_types WHERE pcb_id = $1', [pcbId]);
        if (pcbResult.rows.length === 0) {
            return res.status(404).json({ error: 'PCB type not found.' });
        }
        const pcb = pcbResult.rows[0];

        // Get BOM with component details
        const bomResult = await pool.query(`
            SELECT pcm.quantity_per_unit, pcm.designators, pcm.dni, pcm.variant,
                   c.component_id, c.component_name, c.part_number, c.current_stock,
                   c.category, c.footprint, c.manufacturer, c.supplier,
                   c.unit_price, c.description, c.mounting_type, c.tolerance,
                   c.voltage_rating, c.min_threshold, c.lead_time_days
            FROM pcb_components_mapping pcm
            JOIN components c ON pcm.component_id = c.component_id
            WHERE pcm.pcb_id = $1 AND pcm.dni = false
            ORDER BY c.category, c.component_name
        `, [pcbId]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Invictus Manufacturing';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('BOM', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        // Define columns
        sheet.columns = [
            { header: 'Item No.', key: 'item_no', width: 9 },
            { header: 'Designators', key: 'designators', width: 20 },
            { header: 'Component Type', key: 'category', width: 18 },
            { header: 'Value', key: 'value', width: 14 },
            { header: 'Package', key: 'footprint', width: 12 },
            { header: 'MPN', key: 'part_number', width: 22 },
            { header: 'Manufacturer', key: 'manufacturer', width: 18 },
            { header: 'Supplier', key: 'supplier', width: 16 },
            { header: 'Qty per PCB', key: 'qty_per_pcb', width: 12 },
            { header: 'Build Qty', key: 'build_qty', width: 11 },
            { header: 'Total Required', key: 'total_req', width: 14 },
            { header: 'Stock Available', key: 'stock', width: 14 },
            { header: 'Stock After Build', key: 'stock_after', width: 16 },
            { header: 'Reorder Flag', key: 'reorder', width: 13 },
            { header: 'Mounting', key: 'mounting', width: 10 },
            { header: 'Description', key: 'description', width: 30 }
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 24;

        // Add data rows with Excel formulas
        bomResult.rows.forEach((row, idx) => {
            const rowNum = idx + 2;
            const dataRow = sheet.addRow({
                item_no: idx + 1,
                designators: row.designators || '',
                category: row.category || 'Uncategorized',
                value: row.component_name,
                footprint: row.footprint || '',
                part_number: row.part_number,
                manufacturer: row.manufacturer || '',
                supplier: row.supplier || '',
                qty_per_pcb: row.quantity_per_unit,
                build_qty: buildQty,
                stock: row.current_stock,
                mounting: row.mounting_type || '',
                description: row.description || ''
            });

            // Excel formulas
            // Total Required = Qty per PCB × Build Qty
            dataRow.getCell('total_req').value = { formula: `I${rowNum}*J${rowNum}` };
            // Stock After Build = Stock Available - Total Required
            dataRow.getCell('stock_after').value = { formula: `L${rowNum}-K${rowNum}` };
            // Reorder Flag = IF(Stock After Build < 0, "YES", "NO")
            dataRow.getCell('reorder').value = { formula: `IF(M${rowNum}<0,"YES","NO")` };
        });

        // Conditional formatting — red for negative stock after build
        const lastRow = bomResult.rows.length + 1;
        sheet.addConditionalFormatting({
            ref: `M2:M${lastRow}`,
            rules: [{
                type: 'cellIs',
                operator: 'lessThan',
                formulae: [0],
                style: {
                    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFECACA' } },
                    font: { color: { argb: 'FFDC2626' }, bold: true }
                }
            }]
        });

        // Conditional formatting — yellow for reorder YES
        sheet.addConditionalFormatting({
            ref: `N2:N${lastRow}`,
            rules: [{
                type: 'containsText',
                operator: 'containsText',
                text: 'YES',
                style: {
                    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF3C7' } },
                    font: { color: { argb: 'FFD97706' }, bold: true }
                }
            }]
        });

        // Summary row
        const summaryRow = sheet.addRow({});
        const totalRow = sheet.addRow({
            item_no: '',
            designators: 'TOTALS',
            category: '',
            value: '',
            footprint: '',
            part_number: '',
            manufacturer: '',
            supplier: '',
            qty_per_pcb: { formula: `SUM(I2:I${lastRow})` },
            build_qty: buildQty,
            total_req: { formula: `SUM(K2:K${lastRow})` },
        });
        totalRow.font = { bold: true };

        const filename = `BOM_${pcb.pcb_code}_x${buildQty}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

// GET export shortage report for a PCB production run
const exportShortageReport = async (req, res, next) => {
    try {
        const pcbId = req.params.pcbId;
        const buildQty = parseInt(req.query.buildQty) || 1;

        const pcbResult = await pool.query('SELECT * FROM pcb_types WHERE pcb_id = $1', [pcbId]);
        if (pcbResult.rows.length === 0) {
            return res.status(404).json({ error: 'PCB type not found.' });
        }
        const pcb = pcbResult.rows[0];

        // Get BOM items where stock is insufficient
        const shortageResult = await pool.query(`
            SELECT pcm.quantity_per_unit,
                   c.component_name, c.part_number, c.current_stock,
                   c.category, c.supplier, c.unit_price, c.lead_time_days
            FROM pcb_components_mapping pcm
            JOIN components c ON pcm.component_id = c.component_id
            WHERE pcm.pcb_id = $1 AND pcm.dni = false
              AND c.current_stock < (pcm.quantity_per_unit * $2)
            ORDER BY (pcm.quantity_per_unit * $2 - c.current_stock) DESC
        `, [pcbId, buildQty]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Shortage Report', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
            { header: 'MPN', key: 'part_number', width: 22 },
            { header: 'Component Name', key: 'component_name', width: 28 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Required Qty', key: 'required', width: 14 },
            { header: 'Available Stock', key: 'available', width: 14 },
            { header: 'Shortage Qty', key: 'shortage', width: 14 },
            { header: 'Est. Cost', key: 'est_cost', width: 14 },
            { header: 'Supplier', key: 'supplier', width: 18 },
            { header: 'Lead Time (days)', key: 'lead_time', width: 16 }
        ];

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        headerRow.alignment = { horizontal: 'center' };

        shortageResult.rows.forEach((row) => {
            const required = row.quantity_per_unit * buildQty;
            const shortage = required - row.current_stock;
            const estCost = shortage * (parseFloat(row.unit_price) || 0);

            sheet.addRow({
                part_number: row.part_number,
                component_name: row.component_name,
                category: row.category || '',
                required: required,
                available: row.current_stock,
                shortage: shortage,
                est_cost: Math.round(estCost * 100) / 100,
                supplier: row.supplier || '',
                lead_time: row.lead_time_days || 0
            });
        });

        // Summary
        sheet.addRow({});
        const totalRow = sheet.addRow({
            part_number: 'TOTAL',
            component_name: `${shortageResult.rows.length} components short`,
            shortage: { formula: `SUM(F2:F${shortageResult.rows.length + 1})` },
            est_cost: { formula: `SUM(G2:G${shortageResult.rows.length + 1})` }
        });
        totalRow.font = { bold: true };

        const filename = `Shortage_${pcb.pcb_code}_x${buildQty}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

// GET export procurement list for a PCB production run
const exportProcurementList = async (req, res, next) => {
    try {
        const pcbId = req.params.pcbId;
        const buildQty = parseInt(req.query.buildQty) || 1;

        const pcbResult = await pool.query('SELECT * FROM pcb_types WHERE pcb_id = $1', [pcbId]);
        if (pcbResult.rows.length === 0) {
            return res.status(404).json({ error: 'PCB type not found.' });
        }
        const pcb = pcbResult.rows[0];

        // Get all components that need ordering (shortage + below threshold)
        const procResult = await pool.query(`
            SELECT pcm.quantity_per_unit,
                   c.component_name, c.part_number, c.current_stock,
                   c.category, c.supplier, c.unit_price, c.lead_time_days,
                   c.min_threshold
            FROM pcb_components_mapping pcm
            JOIN components c ON pcm.component_id = c.component_id
            WHERE pcm.pcb_id = $1 AND pcm.dni = false
              AND (c.current_stock < (pcm.quantity_per_unit * $2)
                   OR c.current_stock <= COALESCE(c.min_threshold, 0))
            ORDER BY c.lead_time_days DESC, (pcm.quantity_per_unit * $2 - c.current_stock) DESC
        `, [pcbId, buildQty]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Procurement List', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
            { header: 'MPN', key: 'part_number', width: 22 },
            { header: 'Component Name', key: 'component_name', width: 28 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Order Qty', key: 'order_qty', width: 12 },
            { header: 'Supplier', key: 'supplier', width: 18 },
            { header: 'Unit Price', key: 'unit_price', width: 12 },
            { header: 'Total Cost', key: 'total_cost', width: 14 },
            { header: 'Lead Time', key: 'lead_time', width: 12 },
            { header: 'Priority', key: 'priority', width: 12 }
        ];

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        headerRow.alignment = { horizontal: 'center' };

        procResult.rows.forEach((row) => {
            const required = row.quantity_per_unit * buildQty;
            const shortage = Math.max(0, required - row.current_stock);
            // Add 20% safety buffer
            const orderQty = Math.ceil(shortage * 1.2);
            const unitPrice = parseFloat(row.unit_price) || 0;
            const totalCost = Math.round(orderQty * unitPrice * 100) / 100;
            const priority = (row.lead_time_days || 0) > 7 ? 'HIGH' : 'NORMAL';

            sheet.addRow({
                part_number: row.part_number,
                component_name: row.component_name,
                category: row.category || '',
                order_qty: orderQty,
                supplier: row.supplier || '',
                unit_price: unitPrice,
                total_cost: totalCost,
                lead_time: row.lead_time_days || 0,
                priority: priority
            });
        });

        // Summary
        sheet.addRow({});
        const lastDataRow = procResult.rows.length + 1;
        const totalRow = sheet.addRow({
            part_number: 'TOTAL',
            component_name: `${procResult.rows.length} items to order`,
            order_qty: { formula: `SUM(D2:D${lastDataRow})` },
            total_cost: { formula: `SUM(G2:G${lastDataRow})` }
        });
        totalRow.font = { bold: true };

        // Conditional formatting for HIGH priority
        sheet.addConditionalFormatting({
            ref: `I2:I${lastDataRow}`,
            rules: [{
                type: 'containsText',
                operator: 'containsText',
                text: 'HIGH',
                style: {
                    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFECACA' } },
                    font: { color: { argb: 'FFDC2626' }, bold: true }
                }
            }]
        });

        const filename = `Procurement_${pcb.pcb_code}_x${buildQty}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

module.exports = { exportInventory, exportConsumption, getTransactionHistory, exportBOM, exportShortageReport, exportProcurementList };
