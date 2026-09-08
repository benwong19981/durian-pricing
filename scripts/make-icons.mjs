// One-off: bakes public/icon-192.png and public/icon-512.png from the transparent
// durian mark on the brand green background. Not run at build time — the spec calls
// for real icon files, not ones generated at runtime.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const BRAND = "#11523A";

async function makeIcon(size, markFraction) {
  const markWidth = Math.round(size * markFraction);
  const mark = await sharp(path.join(publicDir, "logo-mark.png")).resize({ width: markWidth }).toBuffer();
  const markMeta = await sharp(mark).metadata();
  const left = Math.round((size - markMeta.width) / 2);
  const top = Math.round((size - markMeta.height) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: mark, left, top }])
    .png()
    .toFile(path.join(publicDir, `icon-${size}.png`));

  console.log(`wrote icon-${size}.png`);
}

// 512 is marked "any maskable" in the manifest, so keep its content inside the
// ~80% safe zone OS launchers use when cropping to a circle or squircle.
await makeIcon(192, 0.72);
await makeIcon(512, 0.66);
await makeIcon(180, 0.72); // apple-touch-icon
