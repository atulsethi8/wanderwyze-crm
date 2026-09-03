// Diagnostic: runs the real line-reconstruction + parser against a PDF on disk.
//   npx esbuild inspect-pdf.mjs --bundle --format=esm --platform=node --external:pdfjs-dist --outfile=inspect-pdf.build.mjs
//   node inspect-pdf.build.mjs "<path to pdf>"
import fs from 'node:fs';
import { pageToLines } from './services/pdfLines';
import { parseETicketText, __debug } from './services/ticketParser';

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

const path = process.argv[2];
const data = new Uint8Array(fs.readFileSync(path));
const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  pages.push(pageToLines(content.items.filter((i) => 'str' in i)).join('\n'));
}
const text = pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

if (process.argv.includes('--text')) {
  console.log('=== RECONSTRUCTED TEXT ===');
  console.log(text);
}

const d = __debug(text);
console.log('=== FIELD BREAKDOWN ===');
console.log('pnr        :', JSON.stringify(d.pnr));
console.log('bookingId  :', JSON.stringify(d.bookingId));
console.log('passengers :', JSON.stringify(d.passengers));
console.log('sectors    :', JSON.stringify(d.sectors, null, 1));
console.log('\n=== PARSE RESULT ===');
console.log(JSON.stringify(parseETicketText(text), null, 2));
