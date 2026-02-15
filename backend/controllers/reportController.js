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

module.exports = { exportInventory, exportConsumption, getTransactionHistory };
