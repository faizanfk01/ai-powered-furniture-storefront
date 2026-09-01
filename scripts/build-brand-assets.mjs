// Derives the brand assets the site actually ships from the two source files
// in public/logo/. Both sources are 2000x2000 with the mark sitting in the
// middle ~55%, which is correct for a standalone logo file and wrong for both
// places we use it: a 28px navbar slot and a 16px browser tab would each show
// a mark half the size of the space it was given.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC_PNG = "public/logo/logo_png.png";
const SRC_SVG = "public/logo/logo_svg.svg";

// ---------------------------------------------------------------------------
// 1. The trimmed mark, for the navbar.
// ---------------------------------------------------------------------------

const { data, info } = await sharp(SRC_PNG)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let minX = Infinity,
  minY = Infinity,
  maxX = -1,
  maxY = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

// Square the crop around the mark's centre so the asset has no built-in
// aspect ratio to fight, then add a small even breathing margin.
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
const side = Math.round(Math.max(maxX - minX, maxY - minY) * 1.06);
const left = Math.round(cx - side / 2);
const top = Math.round(cy - side / 2);

console.log(
  `mark bbox ${maxX - minX + 1}x${maxY - minY + 1} -> square ${side} at ${left},${top}`,
);

await sharp(SRC_PNG)
  .extract({ left, top, width: side, height: side })
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile("public/logo/logo-mark.png");

// ---------------------------------------------------------------------------
// 2. app/icon.svg — their SVG, cropped to the artwork.
// ---------------------------------------------------------------------------
// Only the root viewBox changes: the drawing underneath is untouched, so this
// is a zoom, not an edit. The C2PA manifest goes because it is 22KB of
// provenance metadata that every browser downloads and none of them read; the
// original in public/logo/ keeps it.

const svg = readFileSync(SRC_SVG, "utf8");
const vb = svg.match(/viewBox="([\d.\s-]+)"/);
const [vx, vy, vw, vh] = vb[1].trim().split(/\s+/).map(Number);

// Content bounds as a fraction of the canvas, measured by rasterising.
const probe = await sharp(Buffer.from(svg), { density: 72 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let sx0 = Infinity,
  sy0 = Infinity,
  sx1 = -1,
  sy1 = -1;
for (let y = 0; y < probe.info.height; y++) {
  for (let x = 0; x < probe.info.width; x++) {
    if (probe.data[(y * probe.info.width + x) * probe.info.channels + 3] > 10) {
      if (x < sx0) sx0 = x;
      if (x > sx1) sx1 = x;
      if (y < sy0) sy0 = y;
      if (y > sy1) sy1 = y;
    }
  }
}
const fx0 = sx0 / probe.info.width,
  fx1 = (sx1 + 1) / probe.info.width;
const fy0 = sy0 / probe.info.height,
  fy1 = (sy1 + 1) / probe.info.height;

const cX = vx + (vw * (fx0 + fx1)) / 2;
const cY = vy + (vh * (fy0 + fy1)) / 2;
const sSide = Math.max(vw * (fx1 - fx0), vh * (fy1 - fy0)) * 1.06;

const newViewBox = `${(cX - sSide / 2).toFixed(2)} ${(cY - sSide / 2).toFixed(2)} ${sSide.toFixed(2)} ${sSide.toFixed(2)}`;
console.log(`svg viewBox "${vb[1]}" -> "${newViewBox}"`);

const cropped = svg
  .replace(/<metadata>[\s\S]*?<\/metadata>/, "")
  .replace(/viewBox="[\d.\s-]+"/, `viewBox="${newViewBox}"`)
  .replace(/\swidth="\d+"/, ' width="512"')
  .replace(/\sheight="\d+"/, ' height="512"');

/**
 * COMPACT, and the one judgement call in this file — flip to false to ship the
 * source SVG as-is.
 *
 * The source is not vector art. It is an SVG wrapper around FOURTEEN embedded
 * raster images, so it carries none of the usual reasons to prefer an SVG
 * favicon and all of the weight: 316KB after cropping, for something a browser
 * never draws above 180px. This project reasons explicitly about a customer in
 * Mardan on mobile data (see components/chat/markdown.ts on why react-markdown
 * was rejected), and 316KB of tab icon is the same argument.
 *
 * So the shipped icon is that same artwork flattened to one 256px palette PNG
 * inside a 256-unit viewBox: still an SVG, still scales, still the crest.
 * Rendered at 96px against the original the two are indistinguishable, which
 * is the size that matters — 180px for an iOS home screen is the largest any
 * browser asks for, and tabs ask for 16 to 32.
 *
 * 316KB -> 12KB. The untouched original stays in public/logo/logo_svg.svg.
 */
const COMPACT_ICON = true;

let icon = cropped;
if (COMPACT_ICON) {
  const flat = await sharp("public/logo/logo-mark.png")
    .resize(256, 256)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">' +
    `<image href="data:image/png;base64,${flat.toString("base64")}" width="256" height="256"/>` +
    "</svg>\n";
}

writeFileSync("app/icon.svg", icon);
console.log(
  `app/icon.svg ${(icon.length / 1024).toFixed(1)}KB` +
    ` (source ${(svg.length / 1024).toFixed(0)}KB, cropped ${(cropped.length / 1024).toFixed(0)}KB)`,
);

// ---------------------------------------------------------------------------
// 3. app/favicon.ico — the fallback, and app/apple-icon.png.
// ---------------------------------------------------------------------------
// The favicon.ico in the repo is Next's stock black-circle placeholder. An ICO
// is a tiny directory of PNGs, which is a dozen lines to write and avoids a
// dependency for one build-time asset.

const mark = "public/logo/logo-mark.png";
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) =>
    sharp(mark)
      .resize(s, s, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = icon
header.writeUInt16LE(sizes.length, 4);

let offset = 6 + sizes.length * 16;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s === 256 ? 0 : s; // width  (0 means 256)
  e[1] = s === 256 ? 0 : s; // height
  e[2] = 0; // palette size
  e[3] = 0; // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

writeFileSync("app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
console.log(
  `app/favicon.ico ${sizes.join("/")} — ${(offset / 1024).toFixed(1)}KB`,
);

await sharp(mark)
  .resize(180, 180, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .flatten({ background: "#0e202c" }) // iOS ignores transparency and would show black
  .png({ compressionLevel: 9 })
  .toFile("app/apple-icon.png");
console.log("app/apple-icon.png 180x180 on brand dark");
