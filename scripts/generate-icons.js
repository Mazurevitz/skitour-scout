import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const iconsDir = join(publicDir, 'icons');

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

const svgPath = join(publicDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

async function generateIcons() {
  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate maskable icon with padding (40% safe zone)
  const maskableSize = 512;
  const innerSize = Math.floor(maskableSize * 0.6);
  const padding = Math.floor((maskableSize - innerSize) / 2);

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 30, g: 58, b: 95, alpha: 1 }, // #1e3a5f
    },
  })
    .composite([
      {
        input: await sharp(svgBuffer).resize(innerSize, innerSize).toBuffer(),
        top: padding,
        left: padding,
      },
    ])
    .png()
    .toFile(join(iconsDir, 'icon-maskable-512.png'));

  console.log('Generated icon-maskable-512.png');
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
