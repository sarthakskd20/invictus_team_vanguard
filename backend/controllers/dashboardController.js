const { pool } = require('../config/database');

// GET dashboard summary
const getDashboardSummary = async (req, res, next) => {
    try {
        // Total components
        const totalComponents = await pool.query('SELECT COUNT(*) as count FROM components');

        // Total PCB types
        const totalPCBs = await pool.query('SELECT COUNT(*) as count FROM pcb_types');

        // Low stock count (below 20% of monthly requirement)
        const lowStock = await pool.query(
            'SELECT COUNT(*) as count FROM components WHERE monthly_required_quantity > 0 AND current_stock < (monthly_required_quantity * 0.20)'
        );

        // Total stock value
        const totalValue = await pool.query('SELECT COALESCE(SUM(current_stock * unit_price), 0) as total FROM components');

        // Total production (last 30 days)
        const recentProduction = await pool.query(
            "SELECT COALESCE(SUM(quantity_produced), 0) as total FROM production_entries WHERE production_date >= NOW() - INTERVAL '30 days'"
        );

        // Pending procurement triggers
        const pendingTriggers = await pool.query("SELECT COUNT(*) as count FROM procurement_triggers WHERE status = 'PENDING'");

        res.json({
            total_components: parseInt(totalComponents.rows[0].count),
            total_pcb_types: parseInt(totalPCBs.rows[0].count),
            low_stock_count: parseInt(lowStock.rows[0].count),
            total_inventory_value: parseFloat(totalValue.rows[0].total),
            production_last_30_days: parseInt(recentProduction.rows[0].total),
            pending_procurement_triggers: parseInt(pendingTriggers.rows[0].count)
        });
    } catch (err) {
        next(err);
    }
};

// GET top consumed components (last 30 days)
const getTopConsumed = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const result = await pool.query(`
      SELECT c.component_id, c.component_name, c.part_number, c.category,
             ABS(SUM(ct.quantity_changed)) as total_consumed
      FROM component_transactions ct
      JOIN components c ON ct.component_id = c.component_id
      WHERE ct.transaction_type = 'DEDUCTION'
        AND ct.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY c.component_id, c.component_name, c.part_number, c.category
      ORDER BY total_consumed DESC
      LIMIT $1
    `, [limit]);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET low stock components
const getLowStockComponents = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT component_id, component_name, part_number, current_stock,
             monthly_required_quantity, category,
             CASE
               WHEN monthly_required_quantity > 0
               THEN ROUND((current_stock::decimal / monthly_required_quantity) * 100, 1)
               ELSE 100
             END as stock_percentage
      FROM components
      WHERE monthly_required_quantity > 0
        AND current_stock < (monthly_required_quantity * 0.20)
      ORDER BY stock_percentage ASC
    `);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET consumption over time (for charts)
const getConsumptionTrend = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const result = await pool.query(`
      SELECT DATE(ct.created_at) as date,
             ABS(SUM(ct.quantity_changed)) as total_consumed
      FROM component_transactions ct
      WHERE ct.transaction_type = 'DEDUCTION'
        AND ct.created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY DATE(ct.created_at)
      ORDER BY date ASC
    `, [days]);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET production by PCB type (for charts)
const getProductionByPCB = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT pt.pcb_name, pt.pcb_code,
             SUM(pe.quantity_produced) as total_produced,
             COUNT(pe.entry_id) as entry_count
      FROM production_entries pe
      JOIN pcb_types pt ON pe.pcb_id = pt.pcb_id
      WHERE pe.production_date >= NOW() - INTERVAL '30 days'
      GROUP BY pt.pcb_name, pt.pcb_code
      ORDER BY total_produced DESC
    `);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET stock distribution by category
const getStockByCategory = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT COALESCE(category, 'Uncategorized') as category,
             COUNT(*) as component_count,
             SUM(current_stock) as total_stock,
             SUM(current_stock * unit_price) as total_value
      FROM components
      GROUP BY category
      ORDER BY total_stock DESC
    `);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboardSummary,
    getTopConsumed,
    getLowStockComponents,
    getConsumptionTrend,
    getProductionByPCB,
    getStockByCategory
};
