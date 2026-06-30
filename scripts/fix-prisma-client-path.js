#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sourceDir = path.join(root, 'node_modules', '.prisma', 'client');
const targetDir = path.join(root, 'node_modules', '@prisma', 'client', '.prisma', 'client');

if (!fs.existsSync(sourceDir)) {
  console.warn(`Source Prisma client folder not found at ${sourceDir}. Skipping runtime path fix.`);
  process.exit(0);
}

try {
  fs.rmSync(path.join(root, 'node_modules', '@prisma', 'client', '.prisma'), {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`Prisma runtime client copied from ${sourceDir} to ${targetDir}`);
} catch (error) {
  console.error('Failed to repair Prisma client runtime path:', error);
  process.exit(1);
}
