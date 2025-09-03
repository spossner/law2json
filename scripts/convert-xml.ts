#!/usr/bin/env tsx

import fs from 'node:fs';
import { convert } from '../src/lib/converter.ts';

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.error('Usage: tsx scripts/convert-xml.ts <path-to-xml-file>');
    process.exit(1);
  }
  
  const xmlPath = args[0];
  
  if (!fs.existsSync(xmlPath)) {
    console.error(`Error: File not found: ${xmlPath}`);
    process.exit(1);
  }
  
  try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const lawDocument = convert(xmlContent);
    
    console.log(JSON.stringify(lawDocument, null, 2));
  } catch (error) {
    console.error(`Error converting XML: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();