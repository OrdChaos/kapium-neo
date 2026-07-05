import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const input = 'public/img/icons/svg.svg';
const outDir = 'public/img/icons';

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

await fs.mkdir(outDir, { recursive: true });

for (const size of sizes) {
  await sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(outDir, `icon-${size}x${size}.png`));

  console.log(`generated icon-${size}x${size}.png`);
}

await sharp(input)
  .resize(410, 410, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .extend({
    top: 51,
    bottom: 51,
    left: 51,
    right: 51,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .flatten({
    background: { r: 255, g: 255, b: 255 },
  })
  .png()
  .toFile(path.join(outDir, 'maskable_icon.png'));

console.log('generated maskable_icon.png');
