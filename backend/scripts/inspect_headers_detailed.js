const ExcelJS = require('exceljs');
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

const inspect = async () => {
    const testDataDir = path.resolve(__dirname, '../../test_data');
    const file = 'Mock_PCB_Components_List.xlsx';
    console.log(`Inspecting ${file}...`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(testDataDir, file));
    const sheet = workbook.getWorksheet(1);

    const row = sheet.getRow(1);
    console.log(`Row 1 Cell Count: ${row.cellCount}`);

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.value;
        const norm = normalizeHeader(val);
        console.log(`Col ${colNumber}: "${val}" -> Normalized: "${norm}"`);
    });
};

inspect();
