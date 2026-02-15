const ExcelJS = require('exceljs');
const path = require('path');

const inspect = async () => {
    const testDataDir = path.resolve(__dirname, '../../test_data');
    const file = 'Mock_PCB_Components_List.xlsx';
    console.log(`Inspecting ${file}...`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(testDataDir, file));
    const sheet = workbook.getWorksheet(1);
    const row = sheet.getRow(1);

    [4, 5, 6].forEach(c => {
        const val = row.getCell(c).value;
        console.log(`Col ${c}: "${val}"`);
    });
};

inspect();
