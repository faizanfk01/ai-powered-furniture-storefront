/**
 * Measures whether the hero text is actually readable over each hero photo.
 *
 * White-on-a-photograph is the one thing in this design that cannot be judged
 * by looking at it once on one screen. `object-cover` means the crop changes
 * with the viewport, so the patch of picture under the heading on a desktop is
 * not the patch under it on a phone — and two of these four files have their
 * brightest region (a sheet of drawing paper, a sunlit window) exactly where
 * the text lands.
 *
 * So this samples the real thing: it computes the same crop the browser
 * computes for a given band size and object-position, takes the pixels under
 * each line of text, composites the two overlay layers over them in sRGB the
 * way the compositor does, and reports the WCAG contrast of the text against
 * the result. It reports the WORST case, not the average — the brightest 2% of
 * the patch, because one blown-out highlight behind three words is what
 * readability actually fails on.
 *
 *   node scripts/hero-contrast.mjs
 *
 * Run it after changing the overlay, the crop, a source image or the text
 * colours. The numbers it prints are the ones quoted in
 * components/site/page-hero.tsx; if you change the overlay there, change it
 * here too — a test that reads its expectation out of the code under test
 * proves nothing.
 */

import sharp from "sharp";

// ---------------------------------------------------------------------------
// The design under test. Mirrors components/site/page-hero.tsx.
// ---------------------------------------------------------------------------

const INK = [0x0e, 0x20, 0x2c]; // --color-ink #0e202c
const PAPER = [0xff, 0xff, 0xff]; // --color-paper

/** bg-ink/65, and bg-ink/55 from lg (1024px). */
const flatAlpha = (vw) => (vw >= 1024 ? 0.55 : 0.65);

/** bg-linear-to-r from-ink/45 via-ink/25 to-ink/5, sampled across the band. */
function wedgeAlpha(x, width) {
  const t = width <= 1 ? 0 : x / (width - 1);
  return t <= 0.5
    ? 0.45 + (0.25 - 0.45) * (t / 0.5)
    : 0.25 + (0.05 - 0.25) * ((t - 0.5) / 0.5);
}

/** The four heroes: file and object-position. */
const HEROES = [
  { page: "/", file: "home_page.jpg", pos: [0.5, 0.5] },
  { page: "/custom-orders", file: "custom_orders.jpg", pos: [0.5, 0.65] },
  { page: "/about", file: "about_page.jpg", pos: [0.5, 0.72] },
  { page: "/contact", file: "contact_page.jpg", pos: [0.5, 0.5] },
];

/**
 * The two text colours, and the floor each has to clear.
 *
 * The heading is 30px or more at every width checked here, which is WCAG
 * "large text" and so carries a 3.0 floor. The lede is 16px on a phone and
 * 18px on a desktop — not large text at either — so it carries the full 4.5.
 * The lede is the binding constraint on this whole design, and that is right:
 * it is the line a customer actually has to read.
 */
const TEXT = [
  { name: "heading", alpha: 1, floor: 3.0 },
  { name: "lede", alpha: 0.85, floor: 4.5 },
];

// ---------------------------------------------------------------------------
// Geometry: the band, and where the words sit inside it.
// ---------------------------------------------------------------------------

/**
 * Container's frame at a given viewport: max-w-6xl (72rem) climbing to
 * xl:max-w-7xl (80rem), with the px-4/6/8/10 gutter ramp.
 */
function contentBox(vw) {
  const cap = vw >= 1280 ? 1280 : 1152;
  const pad = vw >= 1280 ? 40 : vw >= 1024 ? 32 : vw >= 640 ? 24 : 16;
  const frame = Math.min(vw, cap);
  return { left: (vw - frame) / 2 + pad, width: frame - pad * 2 };
}

/** The band's height: the min-h floor of 24 / 28 / 32rem. */
const bandHeight = (vw) => (vw >= 1024 ? 512 : vw >= 640 ? 448 : 384);

/**
 * The rows the text occupies, as a fraction of band height. The block is
 * vertically centred, so this brackets the middle: eyebrow and heading above,
 * lede and buttons below. Deliberately generous — it is cheaper to test a band
 * larger than the text than to discover the one line it missed.
 */
const TEXT_ROWS = { heading: [0.2, 0.58], lede: [0.58, 0.78] };

/** The columns the text occupies: the gutter out to the max-w-xl lede cap. */
function textCols(vw) {
  const { left, width } = contentBox(vw);
  return { x0: Math.round(left), x1: Math.round(left + Math.min(width, 576)) };
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (l) =>
  255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

const luminance = ([r, g, b]) =>
  0.2126 * srgbToLinear(r) +
  0.7152 * srgbToLinear(g) +
  0.0722 * srgbToLinear(b);

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** `top` composited onto `bottom` at `alpha`, in sRGB — what the GPU does. */
const over = (bottom, top, alpha) =>
  bottom.map((u, i) => alpha * top[i] + (1 - alpha) * u);

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

/**
 * The source rectangle `object-cover` maps onto a w×h band for a given
 * object-position — the same arithmetic the browser runs.
 */
function coverCrop(srcW, srcH, w, h, [px, py]) {
  const scale = Math.max(w / srcW, h / srcH);
  const visW = Math.min(srcW, Math.round(w / scale));
  const visH = Math.min(srcH, Math.round(h / scale));
  return {
    left: Math.round((srcW - visW) * px),
    top: Math.round((srcH - visH) * py),
    width: visW,
    height: visH,
  };
}

async function measure(hero, vw) {
  const h = bandHeight(vw);
  const path = `public/hero/${hero.file}`;
  const { width: srcW, height: srcH } = await sharp(path).metadata();

  // Render the band exactly as the browser would, then read the pixels back.
  const { data } = await sharp(path)
    .extract(coverCrop(srcW, srcH, vw, h, hero.pos))
    .resize(vw, h, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { x0, x1 } = textCols(vw);
  const flat = flatAlpha(vw);
  const out = {};

  for (const [name, [t0, t1]] of Object.entries(TEXT_ROWS)) {
    const lums = [];
    for (let y = Math.round(t0 * h); y < Math.round(t1 * h); y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * vw + x) * 3;
        const px = [data[i], data[i + 1], data[i + 2]];
        // Both overlay layers, in the order the DOM stacks them.
        const lit = over(over(px, INK, flat), INK, wedgeAlpha(x, vw));
        lums.push(luminance(lit));
      }
    }
    // The brightest 2%: the highlight the text has to survive, not the mean.
    lums.sort((a, b) => a - b);
    out[name] = lums[Math.floor(lums.length * 0.98)];
  }
  return out;
}

// ---------------------------------------------------------------------------

const WIDTHS = [390, 768, 1280, 1920];

console.log(
  "\n  hero contrast — white text over the darkened photograph" +
    "\n  worst case: brightest 2% of the pixels under each line" +
    "\n  floors: heading 3.0 (large text), lede 4.5 (body)\n",
);

let failed = 0;
let tightest = Infinity;

for (const hero of HEROES) {
  console.log(`  ${hero.page}  (${hero.file})`);
  for (const vw of WIDTHS) {
    const bg = await measure(hero, vw);
    const cells = TEXT.map(({ name, alpha, floor }) => {
      // Rebuild a grey of the measured luminance, so the semi-transparent
      // lede has something real to composite against.
      const grey = Array(3).fill(linearToSrgb(bg[name]));
      const text = alpha === 1 ? PAPER : over(grey, PAPER, alpha);
      const ratio = contrast(text, grey);
      if (ratio < floor) failed++;
      tightest = Math.min(tightest, ratio - floor);
      return `${name} ${ratio.toFixed(2)}:1 ${ratio >= floor ? "pass" : "FAIL"}`;
    });
    console.log(`    ${String(vw).padStart(4)}px   ${cells.join("   ")}`);
  }
  console.log("");
}

console.log(
  failed
    ? `  ${failed} check(s) BELOW the floor — increase the overlay.\n`
    : `  all pass; tightest margin ${tightest.toFixed(2)} over its floor.\n`,
);
process.exit(failed ? 1 : 0);
