import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = new URL('../src/posts/', import.meta.url);

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(str) {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = crc32Table[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function genAbbrlink(dateStr) {
  return crc32(dateStr).toString(16).padStart(8, '0');
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return;

  const fm = fmMatch[1];

  if (/^abbrlink:\s*.+/m.test(fm)) {
    console.log(`abbrlink already exists, skipping: ${filePath}`);
    return;
  }

  const dateMatch = fm.match(/^date:\s*["']?(.+?)["']?\s*$/m);
  if (!dateMatch) {
    console.warn(`No date found, skipping: ${filePath}`);
    return;
  }

  const abbrlink = genAbbrlink(dateMatch[1].trim());

  const newFm = fm + `\nabbrlink: "${abbrlink}"`;
  const newContent = content.replace(fmMatch[1], newFm);

  await writeFile(filePath, newContent, 'utf-8');
  console.log(`abbrlink generated: ${abbrlink} → ${filePath}`);
}

const files = (await readdir(POSTS_DIR))
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(POSTS_DIR.pathname, f));

for (const f of files) {
  await processFile(f);
}
