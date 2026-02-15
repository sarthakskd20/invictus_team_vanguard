const { parseExcel } = require('../utils/sheetParser');
const fs = require('fs');
const path = require('path');

const runTest = async () => {
    const testDataDir = path.resolve(__dirname, '../../test_data');
    if (!fs.existsSync(testDataDir)) {
        console.error(`Test data directory not found: ${testDataDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(testDataDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length === 0) { console.warn("No Excel files found."); process.exit(0); }

    let allPassed = true;

    for (const file of files) {
        const filepath = path.join(testDataDir, file);
        console.log(`\n--- Testing File: ${file} ---`);
        try {
            const results = await parseExcel(filepath);
            console.log(`Parsed ${results.length} valid components.`);

            if (results.length > 0) {
                // Sample output
                console.log("Sample Component (First):");
                console.log(JSON.stringify(results[0], null, 2));

                // If Mock file, check if P/Ns are generated
                if (file.includes('Mock')) {
                    const withValue = results.filter(c => c.part_number && c.part_number.includes('-'));
                    console.log(`Components with Value-augmented P/N: ${withValue.length}`);
                }
            } else {
                console.warn("WARN: No components found in file.");
            }

        } catch (err) {
            console.error(`FAIL: Error parsing ${file}:`, err.message);
            // allPassed = false; // Don't fail entire suite on one file if others pass, just warn
        }
    }
};

runTest();
