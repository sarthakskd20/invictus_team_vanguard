const { pool } = require('../config/database');

// POST create production entry (CORE - Atomic Stock Deduction)
const createProductionEntry = async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { pcb_id, quantity_produced, notes } = req.body;
        const userId = req.user.userId;

        if (!pcb_id || !quantity_produced || quantity_produced <= 0) {
            return res.status(400).json({ error: 'Valid PCB ID and production quantity are required.' });
        }

        await client.query('BEGIN');

        // 1. Verify PCB exists
        const pcbCheck = await client.query('SELECT pcb_name, pcb_code FROM pcb_types WHERE pcb_id = $1', [pcb_id]);
        if (pcbCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'PCB type not found.' });
        }

        // 2. Get BOM for this PCB
        const bomResult = await client.query(`
      SELECT pcm.component_id, pcm.quantity_per_unit, c.component_name, c.part_number
      FROM pcb_components_mapping pcm
      JOIN components c ON pcm.component_id = c.component_id
      WHERE pcm.pcb_id = $1
    `, [pcb_id]);

        if (bomResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No BOM defined for this PCB. Add components to the PCB first.' });
        }

        // 3. ROW-LEVEL LOCKING - Lock all required components to prevent race conditions
        const componentIds = bomResult.rows.map(r => r.component_id);
        const lockedComponents = await client.query(
            'SELECT component_id, component_name, part_number, current_stock, monthly_required_quantity FROM components WHERE component_id = ANY($1) FOR UPDATE',
            [componentIds]
        );

        // Build lookup map
        const stockMap = {};
        lockedComponents.rows.forEach(c => { stockMap[c.component_id] = c; });

        // 4. Pre-flight stock check - verify ALL components have enough stock BEFORE deducting any
        const shortages = [];
        for (const bomItem of bomResult.rows) {
            const totalNeeded = bomItem.quantity_per_unit * quantity_produced;
            const available = stockMap[bomItem.component_id]?.current_stock || 0;

            if (available < totalNeeded) {
                shortages.push({
                    component: bomItem.component_name,
                    part_number: bomItem.part_number,
                    needed: totalNeeded,
                    available: available,
                    shortage: totalNeeded - available
                });
            }
        }

        if (shortages.length > 0) {
            await client.query('ROLLBACK');
            const shortageDetails = shortages.map(s =>
                `${s.component} (${s.part_number}): needs ${s.needed}, only ${s.available} available`
            ).join('; ');
            return res.status(400).json({
                error: `Insufficient stock for ${shortages.length} component(s). ${shortageDetails}`,
                shortages
            });
        }

        // 5. Create production entry
        const entryResult = await client.query(
            'INSERT INTO production_entries (pcb_id, quantity_produced, produced_by, notes) VALUES ($1, $2, $3, $4) RETURNING *',
            [pcb_id, quantity_produced, userId, notes || '']
        );
        const entry = entryResult.rows[0];

        // 6. Deduct stock and log transactions
        const deductionReport = [];
        const triggeredProcurements = [];

        for (const bomItem of bomResult.rows) {
            const totalDeduct = bomItem.quantity_per_unit * quantity_produced;
            const comp = stockMap[bomItem.component_id];
            const balanceBefore = comp.current_stock;
            const balanceAfter = balanceBefore - totalDeduct;

            // Deduct
            await client.query(
                'UPDATE components SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE component_id = $2',
                [totalDeduct, bomItem.component_id]
            );

            // Log transaction (immutable audit trail)
            await client.query(
                `INSERT INTO component_transactions (component_id, entry_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note)
         VALUES ($1, $2, 'DEDUCTION', $3, $4, $5, $6)`,
                [bomItem.component_id, entry.entry_id, -totalDeduct, balanceBefore, balanceAfter,
                `Production: ${quantity_produced}x ${pcbCheck.rows[0].pcb_code}`]
            );

            // 7. PROCUREMENT TRIGGER - Check 20% threshold
            const threshold = comp.monthly_required_quantity * 0.20;
            if (balanceAfter < threshold && balanceBefore >= threshold) {
                await client.query(
                    `INSERT INTO procurement_triggers (component_id, current_stock, threshold_quantity, shortage_quantity)
           VALUES ($1, $2, $3, $4)`,
                    [bomItem.component_id, balanceAfter, Math.ceil(threshold), Math.ceil(threshold) - balanceAfter]
                );
                triggeredProcurements.push({
                    component: comp.component_name,
                    part_number: comp.part_number,
                    remaining_stock: balanceAfter,
                    threshold: Math.ceil(threshold)
                });
            }

            deductionReport.push({
                component: comp.component_name,
                part_number: comp.part_number,
                deducted: totalDeduct,
                balance_before: balanceBefore,
                balance_after: balanceAfter
            });
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: `Production entry created. ${quantity_produced}x ${pcbCheck.rows[0].pcb_name} produced.`,
            entry,
            deductions: deductionReport,
            procurement_triggers: triggeredProcurements,
            warnings: triggeredProcurements.length > 0
                ? `${triggeredProcurements.length} component(s) fell below 20% threshold.`
                : null
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// GET production history
const getProductionHistory = async (req, res, next) => {
    try {
        const { pcb_id, start_date, end_date, limit } = req.query;
        let query = `
      SELECT pe.*, pt.pcb_name, pt.pcb_code, u.username as produced_by_name
      FROM production_entries pe
      JOIN pcb_types pt ON pe.pcb_id = pt.pcb_id
      LEFT JOIN users u ON pe.produced_by = u.user_id
    `;

        const conditions = [];
        const params = [];

        if (pcb_id) {
            conditions.push(`pe.pcb_id = $${params.length + 1}`);
            params.push(pcb_id);
        }
        if (start_date) {
            conditions.push(`pe.production_date >= $${params.length + 1}`);
            params.push(start_date);
        }
        if (end_date) {
            conditions.push(`pe.production_date <= $${params.length + 1}`);
            params.push(end_date);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY pe.production_date DESC';

        if (limit) {
            query += ` LIMIT $${params.length + 1}`;
            params.push(parseInt(limit));
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET production entry detail (with component deductions)
const getProductionEntryDetail = async (req, res, next) => {
    try {
        const entryResult = await pool.query(`
      SELECT pe.*, pt.pcb_name, pt.pcb_code, u.username as produced_by_name
      FROM production_entries pe
      JOIN pcb_types pt ON pe.pcb_id = pt.pcb_id
      LEFT JOIN users u ON pe.produced_by = u.user_id
      WHERE pe.entry_id = $1
    `, [req.params.id]);

        if (entryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Production entry not found.' });
        }

        const transactions = await pool.query(`
      SELECT ct.*, c.component_name, c.part_number
      FROM component_transactions ct
      JOIN components c ON ct.component_id = c.component_id
      WHERE ct.entry_id = $1
    `, [req.params.id]);

        res.json({
            ...entryResult.rows[0],
            transactions: transactions.rows
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { createProductionEntry, getProductionHistory, getProductionEntryDetail };
