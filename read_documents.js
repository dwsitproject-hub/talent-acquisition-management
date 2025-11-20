const fs = require('fs');
const path = require('path');

async function readDocx(filePath) {
    try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } catch (error) {
        return `Error reading Word document: ${error.message}`;
    }
}

async function readXlsx(filePath) {
    try {
        const xlsx = require('xlsx');
        const workbook = xlsx.readFile(filePath);
        let content = [];
        
        workbook.SheetNames.forEach(sheetName => {
            content.push(`\n${'='.repeat(50)}`);
            content.push(`SHEET: ${sheetName}`);
            content.push('='.repeat(50) + '\n');
            
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            data.forEach(row => {
                if (row.some(cell => cell !== '')) {
                    content.push(row.join(' | '));
                }
            });
        });
        
        return content.join('\n');
    } catch (error) {
        return `Error reading Excel document: ${error.message}`;
    }
}

async function main() {
    const filePath = process.argv[2];
    
    if (!filePath) {
        console.log('Usage: node read_documents.js <file_path>');
        process.exit(1);
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    let content;
    if (ext === '.docx') {
        content = await readDocx(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
        content = await readXlsx(filePath);
    } else {
        content = `Unsupported file type: ${ext}`;
    }
    
    console.log(content);
}

main().catch(console.error);

