const { pool } = require('../config/database');

// GET all PCB types
const getAllPCBTypes = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT pt.*, 
        (SELECT COUNT(*) FROM pcb_components_mapping WHERE pcb_id = pt.pcb_id) as component_count,
        (SELECT COUNT(*) FROM production_entries WHERE pcb_id = pt.pcb_id) as production_count
      FROM pcb_types pt
      ORDER BY pt.pcb_name ASC
    `);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// GET PCB type by ID with BOM
const getPCBById = async (req, res, next) => {
    try {
        const pcbResult = await pool.query('SELECT * FROM pcb_types WHERE pcb_id = $1', [req.params.id]);
        if (pcbResult.rows.length === 0) {
            return res.status(404).json({ error: 'PCB type not found.' });
        }

        const bomResult = await pool.query(`
      SELECT pcm.mapping_id, pcm.quantity_per_unit, 
             c.component_id, c.component_name, c.part_number, c.current_stock, c.category
      FROM pcb_components_mapping pcm
      JOIN components c ON pcm.component_id = c.component_id
      WHERE pcm.pcb_id = $1
      ORDER BY c.component_name
    `, [req.params.id]);

        res.json({
            ...pcbResult.rows[0],
            bom: bomResult.rows
        });
    } catch (err) {
        next(err);
    }
};

// GET BOM for production preview (with stock availability check)
const getPCBBom = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT pcm.quantity_per_unit,
             c.component_id, c.component_name, c.part_number, c.current_stock, c.category
      FROM pcb_components_mapping pcm
      JOIN components c ON pcm.component_id = c.component_id
      WHERE pcm.pcb_id = $1
      ORDER BY c.component_name
    `, [req.params.id]);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// POST create PCB type with BOM mapping
const createPCBType = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { pcb_name, pcb_code, description, bom } = req.body;

        if (!pcb_name || !pcb_code) {
            return res.status(400).json({ error: 'PCB name and code are required.' });
        }

        await client.query('BEGIN');

        const pcbResult = await client.query(
            'INSERT INTO pcb_types (pcb_name, pcb_code, description) VALUES ($1, $2, $3) RETURNING *',
            [pcb_name, pcb_code, description || '']
        );

        const pcb = pcbResult.rows[0];

        // Insert BOM mappings if provided
        if (bom && Array.isArray(bom) && bom.length > 0) {
            for (const item of bom) {
                if (!item.component_id || !item.quantity_per_unit) continue;
                await client.query(
                    'INSERT INTO pcb_components_mapping (pcb_id, component_id, quantity_per_unit) VALUES ($1, $2, $3)',
                    [pcb.pcb_id, item.component_id, item.quantity_per_unit]
                );
            }
        }

        await client.query('COMMIT');

        // Fetch full PCB with BOM
        const fullPCB = await pool.query(`
      SELECT pcm.mapping_id, pcm.quantity_per_unit,
             c.component_id, c.component_name, c.part_number
      FROM pcb_components_mapping pcm
      JOIN components c ON pcm.component_id = c.component_id
      WHERE pcm.pcb_id = $1
    `, [pcb.pcb_id]);

        res.status(201).json({ ...pcb, bom: fullPCB.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// PUT update PCB type
const updatePCBType = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { pcb_name, pcb_code, description, bom } = req.body;
        const pcbId = req.params.id;

        await client.query('BEGIN');

        await client.query(
            `UPDATE pcb_types SET
        pcb_name = COALESCE($1, pcb_name),
        pcb_code = COALESCE($2, pcb_code),
        description = COALESCE($3, description),
        updated_at = CURRENT_TIMESTAMP
       WHERE pcb_id = $4`,
            [pcb_name, pcb_code, description, pcbId]
        );

        // Replace BOM if provided
        if (bom && Array.isArray(bom)) {
            await client.query('DELETE FROM pcb_components_mapping WHERE pcb_id = $1', [pcbId]);
            for (const item of bom) {
                if (!item.component_id || !item.quantity_per_unit) continue;
                await client.query(
                    'INSERT INTO pcb_components_mapping (pcb_id, component_id, quantity_per_unit) VALUES ($1, $2, $3)',
                    [pcbId, item.component_id, item.quantity_per_unit]
                );
            }
        }

        await client.query('COMMIT');

        // Return updated PCB
        const result = await pool.query('SELECT * FROM pcb_types WHERE pcb_id = $1', [pcbId]);
        const bomResult = await pool.query(`
      SELECT pcm.mapping_id, pcm.quantity_per_unit,
             c.component_id, c.component_name, c.part_number
      FROM pcb_components_mapping pcm
      JOIN components c ON pcm.component_id = c.component_id
      WHERE pcm.pcb_id = $1
    `, [pcbId]);

        res.json({ ...result.rows[0], bom: bomResult.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// DELETE PCB type
const deletePCBType = async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM pcb_types WHERE pcb_id = $1 RETURNING pcb_id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PCB type not found.' });
        }
        res.json({ message: 'PCB type deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAllPCBTypes, getPCBById, getPCBBom, createPCBType, updatePCBType, deletePCBType };
