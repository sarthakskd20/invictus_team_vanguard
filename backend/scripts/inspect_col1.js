const ExcelJS = require('exceljs');
const path = require('path');

const inspect = async () => {
    const testDataDir = path.resolve(__dirname, '../../test_data');
    const file = 'Mock_PCB_Components_List.xlsx';
    console.log(`Inspecting ${file}...`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(testDataDir, file));
    const sheet = workbook.getWorksheet(1);

    // Rows 2-10
    for (let i = 2; i <= 10; i++) {
        const row = sheet.getRow(i);
        console.log(`Row ${i} Col 1: "${row.getCell(1).value}"`);
    }
};

inspect();
