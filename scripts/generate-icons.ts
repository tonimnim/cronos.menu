/**
 * Renders the master `public/favicon.svg` into every raster variant the PWA
 * install flow + legacy browsers expect:
 *
 *   - icon-192.png         (Android install)
 *   - icon-512.png         (Android install + splash, maskable safe zone)
 *   - apple-touch-icon.png (iOS Add to Home Screen, 180x180)
 *   - favicon.ico          (legacy browsers — multi-size 16/32/48)
 *
 * Usage:  npx tsx scripts/generate-icons.ts
 *
 * The SVG carries dark-mode @media rules for browser tabs; sharp ignores
 * those and renders the default (black bg + white dots), which is what we
 * want as the canonical install icon. iOS/Android don't theme-swap PWA
 * icons at runtime.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const PUBLIC = path.resolve(process.cwd(), "public");
const svgPath = path.join(PUBLIC, "favicon.svg");
if (!fs.existsSync(svgPath)) {
  console.error(`✗ ${svgPath} not found`);
  process.exit(1);
}
const svg = fs.readFileSync(svgPath);

const PNG_TARGETS = [
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

async function main() {
  for (const { name, size } of PNG_TARGETS) {
    await sharp(svg)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(PUBLIC, name));
    console.log(`  ✓ ${name} (${size}×${size})`);
  }

  // Multi-resolution ICO. Browsers pick the closest size at use-time.
  const icoSizes = [16, 32, 48];
  const buffers = await Promise.all(
    icoSizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()),
  );
  const ico = await toIco(buffers);
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), ico);
  console.log(`  ✓ favicon.ico (${icoSizes.join("/")})`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
