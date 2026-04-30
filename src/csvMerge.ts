#!/usr/bin/env node

import { mergeCsvFiles } from './csvSort.js';

const [outputPath, ...inputPaths] = process.argv.slice(2);

if (!outputPath || inputPaths.length === 0) {
  console.error('Usage: npm run merge-csv -- <merged.csv> <input.csv> [more-input.csv]');
  process.exitCode = 1;
} else {
  await mergeCsvFiles(outputPath, inputPaths);
  console.log(`Merged ${inputPaths.length} CSV file(s) into ${outputPath}`);
}
