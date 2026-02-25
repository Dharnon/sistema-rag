import pdf from 'pdf-parse';
import { readFileSync } from 'fs';

const testPdf = './AC220H2001-AC02_mayo2020.pdf';

const dataBuffer = readFileSync(testPdf);
const data = await pdf(dataBuffer);

console.log('=== PDF Parse Debug ===');
console.log('Page count:', data.numpages);
console.log('Text length:', data.text.length);
console.log('First 500 chars:', data.text.substring(0, 500));
console.log('\n=== Last 500 chars ===');
console.log(data.text.substring(data.text.length - 500));

// Check for hours section
const hoursMatch = data.text.match(/HORAS[\s\S]{0,2000}/i);
console.log('\n=== Hours Section Found ===');
console.log(hoursMatch ? hoursMatch[0].substring(0, 1000) : 'NOT FOUND');

// Check for page 3 content
if (data.text.includes('106') || data.text.includes('106.5')) {
  console.log('\n=== Found hours value 106/106.5 ===');
} else {
  console.log('\n=== Hours value 106/106.5 NOT FOUND ===');
}
