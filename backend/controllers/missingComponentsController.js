const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

// ─── Utility: Levenshtein distance for fuzzy matching ───
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function fuzzyScore(a, b) {
    if (!a || !b) return 0;
    const la = a.toLowerCase().trim();
    const lb = b.toLowerCase().trim();
    if (la === lb) return 100;
    const maxLen = Math.max(la.length, lb.length);
    if (maxLen === 0) return 100;
    const dist = levenshtein(la, lb);
    return Math.round((1 - dist / maxLen) * 100);
}

// ─── Suggested category from reference designator ───
function suggestCategory(reference, value) {
    const ref = (reference || '').toUpperCase();
    const val = (value || '').toLowerCase();

    if (ref.startsWith('R')) return 'Resistors';
    if (ref.startsWith('C')) return 'Capacitors';
    if (ref.startsWith('L')) return 'Inductors';
    if (ref.startsWith('D')) return 'Diodes';
    if (ref.startsWith('Q')) return 'Transistors';
    if (ref.startsWith('U')) return 'ICs';
    if (ref.startsWith('J') || ref.startsWith('P')) return 'Connectors';
    if (ref.startsWith('SW')) return 'Switches';
    if (ref.startsWith('F')) return 'Fuses';
    if (ref.startsWith('Y') || ref.startsWith('X')) return 'Crystals';
    if (ref.startsWith('LED')) return 'LEDs';
    if (ref.startsWith('TP')) return 'Test Points';
    if (ref.startsWith('T')) return 'Transformers';

    // Value-based fallback
    if (val.includes('resistor') || /^\d+[rkm]?[ωΩ]?$/i.test(val)) return 'Resistors';
    if (val.includes('cap') || /^\d+[pnu]?f$/i.test(val)) return 'Capacitors';
    if (val.includes('inductor') || /^\d+[uμm]?h$/i.test(val)) return 'Inductors';

    return 'Uncategorized';
}

// ─── POST /api/missing-components/reconcile ───
const reconcileBOM = async (req, res, next) => {
    const { bomComponents, buildQty = 1 } = req.body;

    if (!bomComponents || !Array.isArray(bomComponents)) {
        return res.status(400).json({ error: 'Invalid data. Expected "bomComponents" array.' });
    }

    try {
        // Load all components from DB for matching
        const dbResult = await pool.query(
            'SELECT component_id, component_name, part_number, current_stock, category, footprint, manufacturer, description, supplier, unit_price, lead_time_days FROM components'
        );
        const dbComponents = dbResult.rows;

        // Build lookup maps
        const byPartNumber = new Map();
        const bySupplier = new Map();
        dbComponents.forEach(c => {
            if (c.part_number) byPartNumber.set(c.part_number.toLowerCase(), c);
            if (c.supplier) bySupplier.set(c.supplier.toLowerCase(), c);
        });

        const reconciled = [];
        let availableCount = 0;
        let shortageCount = 0;
        let missingCount = 0;
        let totalRequiredQty = 0;
        let totalMissingQty = 0;

        for (const bom of bomComponents) {
            const qtyPerPcb = parseInt(bom.quantity) || 1;
            const totalRequired = qtyPerPcb * buildQty;
            totalRequiredQty += totalRequired;

            let matchedComponent = null;
            let matchConfidence = 0;
            let matchMethod = 'none';

            // Priority 1: Exact MPN match
            if (bom.part_number) {
                const key = bom.part_number.toLowerCase();
                if (byPartNumber.has(key)) {
                    matchedComponent = byPartNumber.get(key);
                    matchConfidence = 100;
                    matchMethod = 'exact_mpn';
                }
            }

            // Priority 2: Value + Package + Type heuristic
            if (!matchedComponent && bom.value && bom.footprint) {
                const bomVal = (bom.value || '').toLowerCase();
                const bomFp = (bom.footprint || '').toLowerCase();
                const bomCat = (bom.category || '').toLowerCase();

                let bestScore = 0;
                let bestMatch = null;
                for (const db of dbComponents) {
                    const dbVal = (db.component_name || '').toLowerCase();
                    const dbFp = (db.footprint || '').toLowerCase();
                    const dbCat = (db.category || '').toLowerCase();

                    let score = 0;
                    if (dbVal === bomVal || dbVal.includes(bomVal) || bomVal.includes(dbVal)) score += 40;
                    if (dbFp && bomFp && (dbFp === bomFp || dbFp.includes(bomFp) || bomFp.includes(dbFp))) score += 25;
                    if (dbCat && bomCat && (dbCat === bomCat)) score += 10;

                    if (score > bestScore && score >= 50) {
                        bestScore = score;
                        bestMatch = db;
                    }
                }

                if (bestMatch) {
                    matchedComponent = bestMatch;
                    matchConfidence = 75;
                    matchMethod = 'heuristic';
                }
            }

            // Priority 3: Description fuzzy match
            if (!matchedComponent && bom.description) {
                let bestFuzzy = 0;
                let bestMatch = null;
                for (const db of dbComponents) {
                    const score = fuzzyScore(bom.description, db.description);
                    if (score > bestFuzzy && score >= 60) {
                        bestFuzzy = score;
                        bestMatch = db;
                    }
                }

                if (bestMatch) {
                    matchedComponent = bestMatch;
                    matchConfidence = 50;
                    matchMethod = 'fuzzy_description';
                }
            }

            // Classify
            let status, stockAvailable, missingQty;
            if (matchedComponent) {
                stockAvailable = matchedComponent.current_stock || 0;
                if (stockAvailable >= totalRequired) {
                    status = 'available';
                    missingQty = 0;
                    availableCount++;
                } else {
                    status = 'shortage';
                    missingQty = totalRequired - stockAvailable;
                    totalMissingQty += missingQty;
                    shortageCount++;
                }
            } else {
                status = 'missing';
                stockAvailable = 0;
                missingQty = totalRequired;
                totalMissingQty += missingQty;
                missingCount++;
            }

            // Determine designators
            const designators = bom.designators || bom.reference || '';

            reconciled.push({
                designators,
                componentType: bom.category || suggestCategory(bom.reference, bom.value),
                value: bom.value || bom.component_name || '',
                package: bom.footprint || '',
                mpn: bom.part_number || '',
                manufacturer: bom.manufacturer || (matchedComponent ? matchedComponent.manufacturer : '') || '',
                qtyPerPcb: qtyPerPcb,
                buildQty: buildQty,
                totalRequired,
                stockAvailable,
                missingQty,
                status,
                suggestedCategory: bom.category || suggestCategory(bom.reference, bom.value),
                matchConfidence,
                matchMethod,
                matchedDbId: matchedComponent ? matchedComponent.component_id : null,
                unitPrice: matchedComponent ? parseFloat(matchedComponent.unit_price) || 0 : 0,
                leadTime: matchedComponent ? matchedComponent.lead_time_days || 0 : 0,
                notes: status === 'missing' ? 'Not found in inventory' :
                    status === 'shortage' ? `Short by ${missingQty} units` : 'In stock',
                // Pass through original data for add-to-inventory
                description: bom.description || '',
                component_name: bom.component_name || bom.value || ''
            });
        }

        // Analytics
        const totalItems = reconciled.length;
        const bomCoveragePercent = totalItems > 0 ? Math.round((availableCount / totalItems) * 100) : 0;
        const buildReadinessScore = totalItems > 0 ? Math.round(((availableCount + (shortageCount * 0.3)) / totalItems) * 100) : 0;
        const estimatedProcurementCost = reconciled
            .filter(r => r.status !== 'available')
            .reduce((sum, r) => sum + (r.missingQty * r.unitPrice), 0);

        res.json({
            success: true,
            reconciliation: reconciled,
            analytics: {
                totalItems,
                availableCount,
                shortageCount,
                missingCount,
                totalRequiredQty,
                totalMissingQty,
                bomCoveragePercent,
                buildReadinessScore,
                estimatedProcurementCost: Math.round(estimatedProcurementCost * 100) / 100,
                totalMissingSKUs: missingCount
            }
        });
    } catch (err) {
        next(err);
    }
};


// ─── POST /api/missing-components/export-report ───
const exportMissingReport = async (req, res, next) => {
    const { reconciliation, analytics } = req.body;

    if (!reconciliation || !Array.isArray(reconciliation)) {
        return res.status(400).json({ error: 'Invalid data. Expected "reconciliation" array.' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Invictus Manufacturing';
        workbook.created = new Date();

        // ─── Sheet 1: Missing Components Report ───
        const missingSheet = workbook.addWorksheet('Missing_Components_Report', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        missingSheet.columns = [
            { header: 'Item No.', key: 'item_no', width: 9 },
            { header: 'Designators', key: 'designators', width: 20 },
            { header: 'Component Type', key: 'componentType', width: 16 },
            { header: 'Value', key: 'value', width: 18 },
            { header: 'Package', key: 'package', width: 14 },
            { header: 'MPN', key: 'mpn', width: 22 },
            { header: 'Qty per PCB', key: 'qtyPerPcb', width: 12 },
            { header: 'Build Quantity', key: 'buildQty', width: 13 },
            { header: 'Total Required Qty', key: 'totalRequired', width: 17 },
            { header: 'Stock Available', key: 'stockAvailable', width: 14 },
            { header: 'Missing Qty', key: 'missingQty', width: 12 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Suggested Category', key: 'suggestedCategory', width: 18 },
            { header: 'Match Confidence', key: 'matchConfidence', width: 15 },
            { header: 'Notes', key: 'notes', width: 30 }
        ];

        // Header style
        const headerRow = missingSheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 26;

        // Filter to missing & shortage only
        const missingItems = reconciliation.filter(r => r.status === 'missing' || r.status === 'shortage');

        missingItems.forEach((item, idx) => {
            const rowNum = idx + 2;
            const row = missingSheet.addRow({
                item_no: idx + 1,
                designators: item.designators,
                componentType: item.componentType,
                value: item.value,
                package: item.package,
                mpn: item.mpn,
                qtyPerPcb: item.qtyPerPcb,
                buildQty: item.buildQty,
                totalRequired: item.totalRequired,
                stockAvailable: item.stockAvailable,
                missingQty: item.missingQty,
                status: item.status.toUpperCase(),
                suggestedCategory: item.suggestedCategory,
                matchConfidence: item.matchConfidence + '%',
                notes: item.notes
            });

            // Color rows by status
            if (item.status === 'missing') {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
                    cell.font = { color: { argb: 'FFDC2626' } };
                });
            } else if (item.status === 'shortage') {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                    cell.font = { color: { argb: 'FFD97706' } };
                });
            }
        });

        // Summary rows
        missingSheet.addRow({});
        const summaryHeaderRow = missingSheet.addRow({
            item_no: '', designators: 'SUMMARY', componentType: '', value: '', package: '', mpn: ''
        });
        summaryHeaderRow.font = { bold: true, size: 12 };

        missingSheet.addRow({ item_no: '', designators: 'Total Missing SKUs:', componentType: analytics?.missingCount || missingItems.filter(i => i.status === 'missing').length });
        missingSheet.addRow({ item_no: '', designators: 'Total Shortage SKUs:', componentType: analytics?.shortageCount || missingItems.filter(i => i.status === 'shortage').length });
        missingSheet.addRow({ item_no: '', designators: 'Total Missing Qty:', componentType: analytics?.totalMissingQty || missingItems.reduce((s, i) => s + i.missingQty, 0) });
        missingSheet.addRow({ item_no: '', designators: 'BOM Coverage:', componentType: (analytics?.bomCoveragePercent || 0) + '%' });
        missingSheet.addRow({ item_no: '', designators: 'Build Readiness Score:', componentType: (analytics?.buildReadinessScore || 0) + '%' });
        missingSheet.addRow({ item_no: '', designators: 'Est. Procurement Cost:', componentType: '$' + (analytics?.estimatedProcurementCost || 0).toFixed(2) });

        // ─── Sheet 2: Full BOM Reconciliation ───
        const fullSheet = workbook.addWorksheet('Full_BOM_Reconciliation', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        fullSheet.columns = [
            { header: 'Item No.', key: 'item_no', width: 9 },
            { header: 'Designators', key: 'designators', width: 20 },
            { header: 'Value', key: 'value', width: 18 },
            { header: 'Package', key: 'package', width: 14 },
            { header: 'MPN', key: 'mpn', width: 22 },
            { header: 'Qty per PCB', key: 'qtyPerPcb', width: 12 },
            { header: 'Total Required', key: 'totalRequired', width: 14 },
            { header: 'Stock Available', key: 'stockAvailable', width: 14 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Match Method', key: 'matchMethod', width: 14 },
            { header: 'Confidence', key: 'matchConfidence', width: 12 }
        ];

        const fullHeader = fullSheet.getRow(1);
        fullHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        fullHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        fullHeader.alignment = { horizontal: 'center', vertical: 'middle' };

        reconciliation.forEach((item, idx) => {
            const row = fullSheet.addRow({
                item_no: idx + 1,
                designators: item.designators,
                value: item.value,
                package: item.package,
                mpn: item.mpn,
                qtyPerPcb: item.qtyPerPcb,
                totalRequired: item.totalRequired,
                stockAvailable: item.stockAvailable,
                status: item.status.toUpperCase(),
                matchMethod: item.matchMethod,
                matchConfidence: item.matchConfidence + '%'
            });

            // Color code
            if (item.status === 'available') {
                row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                row.getCell('status').font = { color: { argb: 'FF059669' }, bold: true };
            } else if (item.status === 'shortage') {
                row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                row.getCell('status').font = { color: { argb: 'FFD97706' }, bold: true };
            } else {
                row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
                row.getCell('status').font = { color: { argb: 'FFDC2626' }, bold: true };
            }
        });

        // ─── Sheet 3: Procurement Recommendation ───
        const procSheet = workbook.addWorksheet('Procurement_Recommendations', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        procSheet.columns = [
            { header: 'MPN', key: 'mpn', width: 22 },
            { header: 'Component', key: 'value', width: 22 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Order Qty', key: 'orderQty', width: 12 },
            { header: 'Unit Price', key: 'unitPrice', width: 12 },
            { header: 'Est. Total Cost', key: 'totalCost', width: 14 },
            { header: 'Lead Time (days)', key: 'leadTime', width: 15 },
            { header: 'Priority', key: 'priority', width: 12 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        const procHeader = procSheet.getRow(1);
        procHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        procHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        procHeader.alignment = { horizontal: 'center', vertical: 'middle' };

        const procItems = reconciliation.filter(r => r.status !== 'available');
        procItems.forEach(item => {
            const orderQty = Math.ceil(item.missingQty * 1.2); // 20% buffer
            const totalCost = Math.round(orderQty * item.unitPrice * 100) / 100;
            const priority = item.status === 'missing' ? 'CRITICAL' : (item.leadTime > 7 ? 'HIGH' : 'NORMAL');

            procSheet.addRow({
                mpn: item.mpn || 'TBD',
                value: item.value,
                category: item.suggestedCategory,
                orderQty,
                unitPrice: item.unitPrice || 0,
                totalCost,
                leadTime: item.leadTime || 0,
                priority,
                status: item.status.toUpperCase()
            });
        });

        // Totals
        procSheet.addRow({});
        const procTotalRow = procSheet.addRow({
            mpn: 'TOTAL',
            value: `${procItems.length} items to procure`,
            orderQty: procItems.reduce((s, i) => s + Math.ceil(i.missingQty * 1.2), 0),
            totalCost: procItems.reduce((s, i) => s + Math.round(Math.ceil(i.missingQty * 1.2) * i.unitPrice * 100) / 100, 0)
        });
        procTotalRow.font = { bold: true };

        // Write to response
        const filename = `Missing_Components_Report_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};


// ─── POST /api/missing-components/add-to-inventory ───
const addMissingToInventory = async (req, res, next) => {
    const { missingComponents } = req.body;

    if (!missingComponents || !Array.isArray(missingComponents)) {
        return res.status(400).json({ error: 'Invalid data. Expected "missingComponents" array.' });
    }

    const client = await pool.connect();
    let added = 0;
    let skipped = 0;

    try {
        await client.query('BEGIN');

        for (const comp of missingComponents) {
            // Only process missing items (not shortage — those already exist)
            if (comp.status !== 'missing') {
                skipped++;
                continue;
            }

            // Check if part_number already exists (double-check)
            const partNumber = comp.mpn || comp.part_number || `MISSING_${comp.value}_${Date.now()}`;
            const existing = await client.query(
                'SELECT component_id FROM components WHERE part_number = $1',
                [partNumber]
            );

            if (existing.rows.length > 0) {
                skipped++;
                continue;
            }

            // Insert with stock = 0
            await client.query(
                `INSERT INTO components (component_name, part_number, current_stock, unit_price, description, manufacturer, footprint, category, monthly_required_quantity)
                VALUES ($1, $2, 0, 0, $3, $4, $5, $6, 0)`,
                [
                    comp.component_name || comp.value || 'Unknown',
                    partNumber,
                    comp.notes || 'Added from missing components detection - Unprocured',
                    comp.manufacturer || '',
                    comp.package || comp.footprint || '',
                    comp.suggestedCategory || comp.componentType || 'Uncategorized'
                ]
            );

            // Create procurement alert if procurement_alerts table exists
            try {
                await client.query(
                    `INSERT INTO procurement_alerts (component_id, alert_type, message, status)
                    SELECT c.component_id, 'LOW_STOCK', $2, 'pending'
                    FROM components c WHERE c.part_number = $1`,
                    [partNumber, `Missing component detected: ${comp.value || partNumber}. Procurement required.`]
                );
            } catch (alertErr) {
                // Procurement alerts table may not exist — skip silently
                console.warn('Procurement alert skipped:', alertErr.message);
            }

            added++;
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Added ${added} missing components to inventory (${skipped} skipped).`,
            added,
            skipped
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

module.exports = { reconcileBOM, exportMissingReport, addMissingToInventory };
