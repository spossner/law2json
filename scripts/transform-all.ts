#!/usr/bin/env ts-node

import fs from 'node:fs';
import path from 'node:path';
import { convert } from '../src/lib/converter.ts';

const DATA_DIR = path.resolve('data');
const OUTPUT_DIR = path.resolve('public', 'law');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface BJNRFile {
  xmlPath: string;
  folderName: string;
  fileName: string;
}

// Recursively find all BJNR XML files
function findBJNRFiles(dir: string): BJNRFile[] {
  const files: BJNRFile[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findBJNRFiles(fullPath));
    } else if (item.startsWith('BJNR') && item.endsWith('.xml')) {
      const folderName = path.basename(path.dirname(fullPath));
      files.push({
        xmlPath: fullPath,
        folderName: folderName,
        fileName: item,
      });
    }
  }

  return files;
}

async function transformAll(): Promise<void> {
  console.log('Scanning for BJNR XML files...');

  const bjnrFiles = findBJNRFiles(DATA_DIR);

  if (bjnrFiles.length === 0) {
    console.log('No BJNR XML files found.');
    return;
  }

  console.log(`Found ${bjnrFiles.length} BJNR XML files:`);
  bjnrFiles.forEach(file => {
    console.log(`  ${file.folderName}: ${file.fileName}`);
  });

  console.log('\nTransforming files...');

  for (const file of bjnrFiles) {
    const outputPath = path.join(OUTPUT_DIR, `${file.folderName}.json`);

    try {
      console.log(`Transforming ${file.folderName}...`);

      const xmlContent = fs.readFileSync(file.xmlPath, 'utf8');
      const lawDocument = convert(xmlContent);

      if (!lawDocument.children.length) {
        console.warn(`⚠️ ${file.folderName}: Parsed 0 nodes - check XML structure`);
      }

      fs.writeFileSync(outputPath, JSON.stringify(lawDocument, null, 2));

      console.log(`✓ Created ${file.folderName}.json`);
    } catch (error) {
      console.error(`✗ Failed to transform ${file.folderName}: ${(error as Error).message}`);
    }
  }

  console.log('\nTransformation complete!');
}

// Run the transformation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  transformAll().catch(console.error);
}

export { transformAll };
