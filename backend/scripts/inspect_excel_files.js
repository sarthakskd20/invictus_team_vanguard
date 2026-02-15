const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const normalizeHeader = (header) => {
    if (!header) return '';
    const h = header.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    if (['partnumber', 'mpn', 'partno', 'pn', 'part'].includes(h)) return 'part_number';
    if (['componentname', 'name', 'component', 'itemname', 'item'].includes(h)) return 'component_name';
    if (['currentstock', 'stock', 'quantity', 'qty', 'onhand'].includes(h)) return 'current_stock';
    if (['monthlyrequired', 'monthlyrequiredquantity', 'monthlyreq', 'monthly', 'req'].includes(h)) return 'monthly_required_quantity';
    if (['unitprice', 'price', 'cost', 'unitcost'].includes(h)) return 'unit_price';
    if (['description', 'desc'].includes(h)) return 'description';
    if (['manufacturer', 'mfr', 'vendor', 'brand'].includes(h)) return 'manufacturer';
    if (['footprint', 'package', 'case'].includes(h)) return 'footprint';
    if (['category', 'type', 'class'].includes(h)) return 'category';

    return h;
};

const inspectFiles = async () => {
    const testDataDir = path.resolve(__dirname, '../../test_data');
    const file = 'Mock_PCB_Components_List.xlsx';
    console.log(`\n================================`);
    console.log(`FILE: ${file}`);
    console.log(`================================`);

    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(path.join(testDataDir, file));
        const sheet = workbook.getWorksheet(1);
        if (!sheet) { console.log("No sheet found."); return; }

        let headerRowIndex = -1;

        for (let r = 1; r <= 5; r++) {
            const row = sheet.getRow(r);
            const values = [];
            let matchCount = 0;
            let tempMap = {};

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const val = cell.value;
                values.push(val);
                if (val) {
                    const normalized = normalizeHeader(val);
                    if (['part_number', 'component_name', 'current_stock'].includes(normalized)) {
                        matchCount++;
                    }
                    if (normalized) {
                        tempMap[normalized] = colNumber;
                    }
                }
            });

            console.log(`Row ${r}: [${values.map(v => JSON.stringify(v)).join(', ')}]`);
            if (Object.keys(tempMap).length > 0) {
                console.log(`  Map:`, JSON.stringify(tempMap));
            }

            if (headerRowIndex === -1 && matchCount >= 1) {
                headerRowIndex = r;
                console.log(`  >>> HEADER ROW DETECTED <<<`);
                // Break after finding header?
            }
        }
    } catch (e) {
        console.error(e);
    }
};

inspectFiles();
