/**
 * Concurrent Production Test Script
 * ===================================
 * Tests Innovation #10: Concurrent Transaction Handling
 * 
 * Fires N simultaneous production requests to verify that
 * row-level locking prevents race conditions and negative stock.
 * 
 * Usage:
 *   node scripts/test_concurrent_production.js
 * 
 * Prerequisites:
 *   - Backend server running on localhost:5000
 *   - PostgreSQL running with seeded data
 *   - At least one user, PCB type, and mapped components exist
 */

const API_BASE = 'http://localhost:5000/api';

// ─── Configuration ───────────────────────────────────────────
const CONFIG = {
    // Credentials (adjust to match your seeded user)
    username: 'admin',
    password: 'admin123',
    // Number of simultaneous requests to fire
    concurrentRequests: 5,
    // PCB to produce (will be auto-detected if not set)
    pcbId: null,
    quantityPerRequest: 1,
};

// ─── Helpers ─────────────────────────────────────────────────
async function login() {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: CONFIG.username,
            password: CONFIG.password,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Login failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.token;
}

async function fetchJSON(url, token) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

async function getComponentStock(componentId, token) {
    const data = await fetchJSON(`${API_BASE}/components/${componentId}`, token);
    return data.current_stock;
}

// ─── Main Test ───────────────────────────────────────────────
async function runTest() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   🔒 CONCURRENT TRANSACTION HANDLING — LIVE TEST           ║');
    console.log('║   Innovation #10: Race Condition Prevention                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Step 1: Authenticate
    console.log('🔑 Authenticating...');
    let token;
    try {
        token = await login();
        console.log('   ✅ Login successful\n');
    } catch (err) {
        console.error('   ❌ Login failed:', err.message);
        console.log('\n   Make sure the server is running and credentials are correct.');
        process.exit(1);
    }

    // Step 2: Find a PCB to test with
    console.log('📋 Finding a testable PCB...');
    const pcbs = await fetchJSON(`${API_BASE}/pcb-types`, token);

    if (pcbs.length === 0) {
        console.error('   ❌ No PCB types found. Seed data first.');
        process.exit(1);
    }

    let testPcb = null;
    let bomItems = [];
    let componentStocks = {};

    for (const pcb of pcbs) {
        const pcbId = CONFIG.pcbId || pcb.pcb_id;
        const bom = await fetchJSON(`${API_BASE}/pcb-types/${pcbId}/bom`, token);
        if (bom.length > 0) {
            testPcb = pcb;
            testPcb.pcb_id = pcbId;
            bomItems = bom;

            // Get current stock for each component
            for (const item of bom) {
                componentStocks[item.component_id] = {
                    name: item.component_name,
                    stock: item.current_stock,
                    required_per_unit: item.quantity_per_unit,
                };
            }
            break;
        }
        if (CONFIG.pcbId) break;
    }

    if (!testPcb) {
        console.error('   ❌ No PCB with mapped components found.');
        process.exit(1);
    }

    console.log(`   📦 PCB: ${testPcb.pcb_name} (ID: ${testPcb.pcb_id})`);
    console.log(`   📊 BOM has ${bomItems.length} component(s)\n`);

    // Step 3: Calculate expectations
    const maxProducible = Math.min(
        ...bomItems.map(item => Math.floor(item.current_stock / item.quantity_per_unit))
    );

    const N = CONFIG.concurrentRequests;
    const expectedSuccesses = Math.min(N, maxProducible);
    const expectedFailures = N - expectedSuccesses;

    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│  PRE-TEST STATE                                    │');
    console.log('├─────────────────────────────────────────────────────┤');
    for (const item of bomItems) {
        const cs = componentStocks[item.component_id];
        console.log(`│  ${cs.name.padEnd(30)} Stock: ${String(cs.stock).padStart(6)} │`);
        console.log(`│  ${''.padEnd(30)} Need/unit: ${String(cs.required_per_unit).padStart(3)} │`);
    }
    console.log('├─────────────────────────────────────────────────────┤');
    console.log(`│  Max producible: ${maxProducible}                              │`);
    console.log(`│  Concurrent requests: ${N}                           │`);
    console.log(`│  Expected successes: ${expectedSuccesses}                            │`);
    console.log(`│  Expected failures: ${expectedFailures}                             │`);
    console.log('└─────────────────────────────────────────────────────┘\n');

    // Step 4: Fire concurrent requests
    console.log(`🚀 Firing ${N} simultaneous production requests...\n`);

    const startTime = Date.now();

    const promises = Array(N).fill(null).map((_, i) =>
        fetch(`${API_BASE}/production/entry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                pcb_id: testPcb.pcb_id,
                quantity_produced: CONFIG.quantityPerRequest,
                notes: `Concurrent test request #${i + 1}`,
            }),
        }).then(async (res) => {
            const body = await res.json();
            return { index: i + 1, status: res.status, body };
        }).catch((err) => {
            return { index: i + 1, status: 'ERROR', body: { error: err.message } };
        })
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    // Step 5: Analyze results
    const successes = results.filter(r => r.status === 201);
    const failures = results.filter(r => r.status !== 201);

    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│  RESULTS                                           │');
    console.log('├─────────────────────────────────────────────────────┤');

    for (const r of results) {
        const icon = r.status === 201 ? '✅' : '❌';
        const msg = r.status === 201
            ? r.body.message
            : (r.body.error || 'Unknown error').substring(0, 45);
        console.log(`│  ${icon} Request #${r.index}: [${r.status}] ${msg.substring(0, 35).padEnd(35)} │`);
    }

    console.log('├─────────────────────────────────────────────────────┤');
    console.log(`│  Total time: ${elapsed}ms                              │`);
    console.log(`│  Successes: ${successes.length} (expected: ${expectedSuccesses})                      │`);
    console.log(`│  Failures: ${failures.length} (expected: ${expectedFailures})                       │`);
    console.log('└─────────────────────────────────────────────────────┘\n');

    // Step 6: Verify final stock
    console.log('🔍 Verifying final stock...\n');

    let allCorrect = true;
    for (const item of bomItems) {
        const finalStock = await getComponentStock(item.component_id, token);
        const cs = componentStocks[item.component_id];
        const expectedStock = cs.stock - (successes.length * cs.required_per_unit);

        const correct = finalStock === expectedStock && finalStock >= 0;
        const icon = correct ? '✅' : '❌';

        console.log(`   ${icon} ${cs.name}`);
        console.log(`      Before: ${cs.stock} → After: ${finalStock} (expected: ${expectedStock})`);

        if (!correct) allCorrect = false;
    }

    // Step 7: Final verdict
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    if (allCorrect && successes.length === expectedSuccesses) {
        console.log('║  ✅ TEST PASSED — No race conditions detected!             ║');
        console.log('║  Row-level locking is working correctly.                    ║');
    } else {
        console.log('║  ❌ TEST FAILED — Unexpected results detected!              ║');
        console.log('║  Check the details above for mismatches.                    ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

runTest().catch(console.error);
