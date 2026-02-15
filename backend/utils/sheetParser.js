const ExcelJS = require('exceljs');

/**
 * Normalizes header strings to a standard key format.
 * @param {string} header - The raw header string.
 * @returns {string} - The normalized key.
 */
const normalizeHeader = (header) => {
    if (!header) return '';
    const h = header.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // Mapping rules
    if (['partnumber', 'mpn', 'partno', 'pn', 'part', 'manufacturerpartnumber'].includes(h)) return 'part_number';
    if (['componentname', 'name', 'component', 'itemname', 'item', 'productname'].includes(h)) return 'component_name';
    if (['currentstock', 'stock', 'quantity', 'qty', 'onhand', 'amount', 'count'].includes(h)) return 'current_stock';
    if (['monthlyrequired', 'monthlyrequiredquantity', 'monthlyreq', 'monthly', 'req'].includes(h)) return 'monthly_required_quantity';
    if (['unitprice', 'price', 'cost', 'unitcost'].includes(h)) return 'unit_price';
    if (['description', 'desc', 'details', 'notes'].includes(h)) return 'description';
    if (['manufacturer', 'mfr', 'vendor', 'brand'].includes(h)) return 'manufacturer';
    if (['footprint', 'package', 'case', 'packagefootprint'].includes(h)) return 'footprint';
    if (['category', 'type', 'class'].includes(h)) return 'category';
    if (['value', 'rating', 'val', 'valuerating'].includes(h)) return 'value'; // Intermediate for description/name augmentation

    return h;
};

/**
 * Parses an Excel file buffer or path and returns an array of component objects.
 * Uses robust column mapping.
 * @param {string} filepath - Path to the Excel file.
 * @returns {Promise<Array>} - Array of component objects.
 */
const parseExcel = async (filepath) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const sheet = workbook.getWorksheet(1); // Assume first sheet

    if (!sheet) {
        throw new Error('No sheets found in Excel file');
    }

    // 1. Identify Headers
    let headerRowIndex = -1;
    let columnMap = {}; // { normalizedKey: columnIndex }
    let maxMatchCount = 0;

    // Scan first 10 rows to find the best header candidate
    for (let r = 1; r <= 10; r++) {
        const row = sheet.getRow(r);
        let matchCount = 0;
        let tempMap = {};

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const val = cell.value;
            if (val) {
                const normalized = normalizeHeader(val);
                // Check if it matches any known key
                if (['part_number', 'component_name', 'current_stock', 'manufacturer', 'description', 'value'].includes(normalized)) {
                    matchCount++;
                }
                if (normalized) {
                    tempMap[normalized] = colNumber;
                }
            }
        });

        if (matchCount > maxMatchCount) {
            maxMatchCount = matchCount;
            headerRowIndex = r;
            columnMap = tempMap;
        }
    }

    if (headerRowIndex === -1) {
        throw new Error('Could not identify header row. Ensure columns like "Part Number", "Name", or "Qty" exist.');
    }

    // FALLBACK LOGIC: If key columns missing, infer from others
    // If Part Number is missing, try to use Component Name or Description as fallback
    if (!columnMap['part_number']) {
        if (columnMap['component_name']) columnMap['part_number'] = columnMap['component_name'];
        else if (columnMap['description']) columnMap['part_number'] = columnMap['description'];
    }

    // If Component Name is missing, try to use Part Number or Description
    if (!columnMap['component_name']) {
        if (columnMap['part_number']) columnMap['component_name'] = columnMap['part_number'];
        else if (columnMap['description']) columnMap['component_name'] = columnMap['description'];
    }

    const components = [];

    // 2. Iterate Data Rows
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return; // Skip header and pre-header rows

        const comp = {
            component_name: '',
            part_number: '',
            current_stock: 0,
            monthly_required_quantity: 0,
            unit_price: 0,
            description: '',
            manufacturer: '',
            footprint: '',
            category: ''
        };

        // Helper to safely get text
        const getVal = (key) => columnMap[key] ? (row.getCell(columnMap[key]).text || '').trim() : '';

        // Helper to safely get numbers
        const getNum = (key) => {
            if (!columnMap[key]) return 0;
            const cell = row.getCell(columnMap[key]);
            const val = cell.value;
            if (val === null || val === undefined || val === '') return 0;
            // Handle numeric text like "$0.05" or "1,200"
            const str = val.toString().replace(/[^0-9.-]/g, '');
            return parseFloat(str) || 0;
        };

        comp.part_number = getVal('part_number');
        comp.component_name = getVal('component_name');
        comp.manufacturer = getVal('manufacturer');
        comp.description = getVal('description');
        comp.footprint = getVal('footprint');
        comp.category = getVal('category');

        comp.current_stock = Math.floor(getNum('current_stock'));
        comp.monthly_required_quantity = Math.floor(getNum('monthly_required_quantity'));
        comp.unit_price = getNum('unit_price');

        // Augment description/name with Value if present
        const val = getVal('value');
        if (val) {
            // Append value to component name if not already there, to make it more descriptive
            if (comp.component_name && !comp.component_name.includes(val)) {
                comp.component_name += ` ${val}`;
            }
            if (comp.description && !comp.description.includes(val)) {
                comp.description += ` ${val}`;
            }

            // If part_number was fallback-mapped from component_name, append value to it too to make it more unique
            if (comp.part_number === getVal('component_name')) {
                comp.part_number += `-${val}`;
            }
        }

        // Final cleanup
        comp.component_name = comp.component_name.trim();
        comp.part_number = comp.part_number.trim();
        comp.description = comp.description.trim();

        // Only add if it has at least a part number or name
        if (comp.part_number || comp.component_name) {
            // Ensure we have a P/N if missing
            if (!comp.part_number) comp.part_number = comp.component_name;
            if (!comp.component_name) comp.component_name = comp.part_number;

            components.push(comp);
        }
    });

    return components;
};

module.exports = { parseExcel };
