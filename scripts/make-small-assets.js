#!/usr/bin/env node
// Node version of make-small-assets.sh using sharp for full format support
// Resizes all images in public/assets/photography to max width 800px and
// writes the result into both public/assets/small_assets/photography and
// public/small_assets/photography, preserving directory structure.

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC_DIR = path.join(process.cwd(), 'public', 'assets', 'photography');
const DST1 = path.join(process.cwd(), 'public', 'assets', 'small_assets', 'photography');
const DST2 = path.join(process.cwd(), 'public', 'small_assets', 'photography');
const MAX_WIDTH = 800;
const exts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function processFile(file) {
  const rel = path.relative(SRC_DIR, file);
  const out1 = path.join(DST1, rel);
  const out2 = path.join(DST2, rel);
  ensureDir(path.dirname(out1));
  ensureDir(path.dirname(out2));

  sharp(file)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .toFile(out1)
    .then(() => {
      fs.copyFileSync(out1, out2);
      console.log(`resized ${rel}`);
    })
    .catch((err) => {
      // fallback: copy original
      fs.copyFileSync(file, out1);
      fs.copyFileSync(file, out2);
      console.warn(`fallback copy ${rel}: ${err.message}`);
    });
}

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  items.forEach((it) => {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      walk(full);
    } else if (it.isFile()) {
      if (exts.includes(path.extname(it.name).toLowerCase())) {
        processFile(full);
      }
    }
  });
}

ensureDir(DST1);
ensureDir(DST2);
walk(SRC_DIR);
console.log('Done generating small assets (node).');
