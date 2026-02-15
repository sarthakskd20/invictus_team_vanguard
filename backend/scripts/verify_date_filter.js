const { pool } = require('../config/database');
// using native Date

const runTest = async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
    console.log(`Running test for date: ${today}`);

    try {
        // 1. Create Dummy Component
        const compRes = await pool.query(
            `INSERT INTO components (component_name, part_number, current_stock, monthly_required_quantity)
             VALUES ('TEST_DATE_FILTER', 'TEST-9999', 100, 10) RETURNING component_id`
        );
        const compId = compRes.rows[0].component_id;
        console.log(`Created dummy component: ${compId}`);

        // 2. Insert Transactions at edges of the day
        // We need to be careful about Timezones. Postgres NOW() typically returns server time.
        // Let's force timestamps string concatenations relative to 'today'

        // Transaction 1: Early morning
        await pool.query(
            `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note, created_at)
             VALUES ($1, 'DEDUCTION', -1, 100, 99, 'Early Morning Test', ($2 || ' 00:00:01')::timestamp)`,
            [compId, today]
        );

        // Transaction 2: Late night
        await pool.query(
            `INSERT INTO component_transactions (component_id, transaction_type, quantity_changed, balance_before, balance_after, reference_note, created_at)
             VALUES ($1, 'DEDUCTION', -1, 99, 98, 'Late Night Test', ($2 || ' 23:59:59')::timestamp)`,
            [compId, today]
        );

        console.log("Inserted 2 transactions.");

        // 3. Run Query
        const start_date = today;
        const end_date = today;

        const query = `
            SELECT ct.created_at, ct.transaction_type, ct.reference_note
            FROM component_transactions ct
            WHERE ct.component_id = $1
            AND ct.transaction_type = 'DEDUCTION'
            AND ct.created_at::date >= $2
            AND ct.created_at::date <= $3
        `;

        const res = await pool.query(query, [compId, start_date, end_date]);

        console.log(`Query returned ${res.rows.length} rows.`);
        res.rows.forEach(r => console.log(` - ${r.created_at} : ${r.reference_note}`));

        if (res.rows.length === 2) {
            console.log("SUCCESS: Both transactions found!");
        } else {
            console.error("FAILURE: Expected 2 transactions.");
            process.exit(1);
        }

    } catch (err) {
        console.error("Test Error:", err);
        process.exit(1);
    } finally {
        // Cleanup
        try {
            await pool.query("DELETE FROM components WHERE part_number = 'TEST-9999'");
            console.log("Cleanup complete.");
        } catch (e) { console.error("Cleanup failed", e); }
        pool.end();
    }
};

runTest();
