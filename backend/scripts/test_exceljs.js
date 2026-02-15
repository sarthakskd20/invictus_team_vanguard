const ExcelJS = require('exceljs');

const test = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.getRow(1).values = ['Val1', 'Val2'];

    const row = sheet.getRow(1);
    try {
        const cell = row.getCell(undefined);
        console.log("getCell(undefined):", cell ? JSON.stringify(cell.value) : "null");
        console.log("getCell(undefined).text:", cell ? cell.text : "undefined");
        console.log("getCell(undefined).address:", cell ? cell.address : "undefined");
    } catch (e) {
        console.log("getCell(undefined) threw:", e.message);
    }

    try {
        const cell2 = row.getCell(null);
        console.log("getCell(null):", cell2 ? JSON.stringify(cell2.value) : "null");
    } catch (e) {
        console.log("getCell(null) threw:", e.message);
    }
};

test();
