const { pool } = require('../config/database');

// GET all procurement triggers
const getAllTriggers = async (req, res, next) => {
    try {
        const { status } = req.query;
        let query = `
      SELECT pt.*, c.component_name, c.part_number, c.current_stock as latest_stock, c.category,
             u.username as acknowledged_by_name
      FROM procurement_triggers pt
      JOIN components c ON pt.component_id = c.component_id
      LEFT JOIN users u ON pt.acknowledged_by = u.user_id
    `;

        const params = [];
        if (status) {
            query += ' WHERE pt.status = $1';
            params.push(status);
        }

        query += ' ORDER BY pt.triggered_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// PUT acknowledge trigger
const acknowledgeTrigger = async (req, res, next) => {
    try {
        const triggerId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE procurement_triggers SET
        status = 'ACKNOWLEDGED',
        acknowledged_by = $1,
        acknowledged_at = CURRENT_TIMESTAMP
       WHERE trigger_id = $2 AND status = 'PENDING'
       RETURNING *`,
            [userId, triggerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trigger not found or already acknowledged.' });
        }

        res.json({ message: 'Trigger acknowledged.', trigger: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

// PUT resolve trigger
const resolveTrigger = async (req, res, next) => {
    try {
        const triggerId = req.params.id;

        const result = await pool.query(
            `UPDATE procurement_triggers SET status = 'RESOLVED' WHERE trigger_id = $1 RETURNING *`,
            [triggerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trigger not found.' });
        }

        res.json({ message: 'Trigger resolved.', trigger: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAllTriggers, acknowledgeTrigger, resolveTrigger };
