// Seed data for local/staging development.
//
// Run with `npx prisma db seed` (wired via the "prisma.seed" key in
// package.json) or directly with `npx tsx prisma/seed.ts`.
//
// Idempotency strategy: upsert on the natural keys (Category.slug,
// Product.slug) and on fixed ids for reviews, rather than truncating tables.
// Truncating would work today, but Phase 2.5 attaches ProductImage rows to
// these products — a delete-then-recreate seed would cascade those away and
// hand every product a new cuid on every run. Upserting keeps the ids stable.
import "dotenv/config";

import { db } from "../lib/db";
import { ReviewStatus, StockStatus } from "../lib/generated/prisma/enums";

const categories = [
  { slug: "sofas", name: "Sofas" },
  { slug: "beds", name: "Beds" },
  { slug: "tables", name: "Tables" },
  { slug: "chairs", name: "Chairs" },
  { slug: "office-sets", name: "Office Sets" },
];

// `price` is whole PKR. `categorySlug` is resolved to a real id below.
const products = [
  {
    slug: "karachi-3-seater-fabric-sofa",
    name: "Karachi 3-Seater Fabric Sofa",
    categorySlug: "sofas",
    price: 68000,
    dimensions: '84" W x 36" D x 32" H',
    description:
      "A deep-seated three-seater upholstered in a hard-wearing woven fabric, built on a kiln-dried sheesham frame with high-density foam cushions. The removable seat covers make it practical for a family drawing room. Available in charcoal, beige and rust.",
    stockStatus: StockStatus.IN_STOCK,
  },
  {
    slug: "malka-l-shaped-sectional-sofa",
    name: "Malka L-Shaped Sectional Sofa",
    categorySlug: "sofas",
    price: 112000,
    dimensions: '118" W x 74" D x 33" H',
    description:
      "A six-seater L-shaped sectional with a chaise that can be ordered on either the left or right side to suit your room. Pocket-spring seating, solid wood legs and a matching bolster set. Built to order in your choice of fabric — allow three to four weeks.",
    stockStatus: StockStatus.MADE_TO_ORDER,
  },
  {
    slug: "shalimar-king-bed-with-storage",
    name: "Shalimar King Bed with Storage",
    categorySlug: "beds",
    price: 95000,
    dimensions: '84" W x 80" L x 48" H',
    description:
      "A king-size bed with a hydraulic lift-up base, giving you the full footprint of the bed as storage for quilts and off-season bedding. Padded headboard with a hand-stitched channel detail. Mattress not included.",
    stockStatus: StockStatus.IN_STOCK,
  },
  {
    slug: "takht-solid-sheesham-double-bed",
    name: "Takht Solid Sheesham Double Bed",
    categorySlug: "beds",
    price: 78000,
    dimensions: '78" W x 75" L x 42" H',
    description:
      "A traditional double bed in solid sheesham with hand-carved posts and a slatted base for airflow. Finished in a natural matte polish that shows the grain rather than hiding it. Assembles on site with four bolts.",
    stockStatus: StockStatus.OUT_OF_STOCK,
  },
  {
    slug: "bagh-six-seater-dining-table",
    name: "Bagh Six-Seater Dining Table",
    categorySlug: "tables",
    price: 88000,
    dimensions: '72" W x 38" D x 30" H',
    description:
      "A six-seater dining table with a 25mm solid top and a trestle base that keeps the leg room clear at both ends. Supplied with six matching upholstered dining chairs. Made to order in walnut or natural oak finish.",
    stockStatus: StockStatus.MADE_TO_ORDER,
  },
  {
    slug: "swat-walnut-coffee-table",
    name: "Swat Walnut Coffee Table",
    categorySlug: "tables",
    price: 22000,
    dimensions: '48" W x 24" D x 18" H',
    description:
      "A low centre table in walnut-finished engineered wood with a lower shelf for magazines and remotes. Tapered legs and rounded corners — a safe shape for a room where children play. Wipes clean with a damp cloth.",
    stockStatus: StockStatus.IN_STOCK,
  },
  {
    slug: "kaghan-rattan-accent-chair",
    name: "Kaghan Rattan Accent Chair",
    categorySlug: "chairs",
    price: 18500,
    dimensions: '28" W x 30" D x 34" H',
    description:
      "A hand-woven rattan accent chair on a powder-coated steel frame, light enough to move between the lounge and the terrace. Comes with a removable foam seat pad in off-white cotton.",
    stockStatus: StockStatus.IN_STOCK,
  },
  {
    slug: "hazara-wingback-armchair",
    name: "Hazara Wingback Armchair",
    categorySlug: "chairs",
    price: 35000,
    dimensions: '32" W x 34" D x 44" H',
    description:
      "A classic wingback armchair with a buttoned back, rolled arms and turned front legs in solid wood. High sides make it a genuinely comfortable reading chair rather than a decorative one. Upholstered in a textured olive weave.",
    stockStatus: StockStatus.OUT_OF_STOCK,
  },
  {
    slug: "mardan-executive-office-set",
    name: "Mardan Executive Office Set",
    categorySlug: "office-sets",
    price: 118000,
    dimensions: '71" W x 32" D x 30" H (desk)',
    description:
      "A complete executive setup: a large desk with a lockable three-drawer pedestal, a side return unit, a high-back leather-finish office chair and two visitor chairs. Cable routing is built into the modesty panel.",
    stockStatus: StockStatus.MADE_TO_ORDER,
  },
  {
    slug: "gulbahar-study-desk-and-chair-set",
    name: "Gulbahar Study Desk & Chair Set",
    categorySlug: "office-sets",
    price: 32000,
    dimensions: '47" W x 22" D x 30" H (desk)',
    description:
      "A compact study desk with an open shelf, a single drawer and a matching cushioned chair — sized for a student's room or a work-from-home corner. Scratch-resistant laminate top in light oak.",
    stockStatus: StockStatus.IN_STOCK,
  },
];

// Fixed ids so re-running the seed updates these rows instead of piling up
// duplicates — Review has no natural unique key to upsert on.
// `productSlug: null` is a general store review rather than a product review.
const reviews = [
  {
    id: "seed-review-karachi-sofa",
    productSlug: "karachi-3-seater-fabric-sofa",
    authorName: "Bilal Ahmad",
    rating: 5,
    body: "Bought the three-seater in charcoal last month. The foam is firm without being hard and it has not sagged at all so far. Delivery to Mardan cantt was the same day I ordered.",
    status: ReviewStatus.APPROVED,
  },
  {
    id: "seed-review-shalimar-bed",
    productSlug: "shalimar-king-bed-with-storage",
    authorName: "Sana Iqbal",
    rating: 4,
    body: "The storage under the bed is the reason I bought it and it holds far more than I expected. Only complaint is that the lift mechanism is a little stiff for the first few weeks. Headboard finish is lovely.",
    status: ReviewStatus.APPROVED,
  },
  {
    id: "seed-review-general-service",
    productSlug: null,
    authorName: "Imran Yousafzai",
    rating: 5,
    body: "Have furnished two rooms from this showroom now. Staff let you take your time, prices are what they say on the tag, and they followed up on WhatsApp when a made-to-order item was ready.",
    status: ReviewStatus.APPROVED,
  },
  {
    id: "seed-review-takht-bed",
    productSlug: "takht-solid-sheesham-double-bed",
    authorName: "Hamza Khan",
    rating: 2,
    body: "The wood itself is good quality but one of the carved posts arrived with a chip in the polish and it took two follow-ups to get someone out to touch it up. Ended up fine, but the process was frustrating.",
    status: ReviewStatus.PENDING,
  },
];

async function main() {
  const categoryIdBySlug = new Map<string, string>();

  for (const category of categories) {
    const row = await db.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name },
    });
    categoryIdBySlug.set(row.slug, row.id);
  }

  const productIdBySlug = new Map<string, string>();

  for (const { categorySlug, ...product } of products) {
    const categoryId = categoryIdBySlug.get(categorySlug);

    if (!categoryId) {
      throw new Error(
        `Product "${product.slug}" references unknown category "${categorySlug}".`,
      );
    }

    const row = await db.product.upsert({
      where: { slug: product.slug },
      create: { ...product, categoryId },
      // aiSummary is deliberately left out of both branches: null on create,
      // and untouched on update so a re-seed does not throw away a summary
      // Phase 3 has already paid Groq to generate.
      update: { ...product, categoryId },
    });
    productIdBySlug.set(row.slug, row.id);
  }

  for (const { productSlug, ...review } of reviews) {
    let productId: string | null = null;

    if (productSlug !== null) {
      productId = productIdBySlug.get(productSlug) ?? null;

      if (!productId) {
        throw new Error(
          `Review "${review.id}" references unknown product "${productSlug}".`,
        );
      }
    }

    await db.review.upsert({
      where: { id: review.id },
      create: { ...review, productId },
      update: { ...review, productId },
    });
  }

  const [categoryCount, productCount, reviewCount] = await Promise.all([
    db.category.count(),
    db.product.count(),
    db.review.count(),
  ]);

  console.log(
    `Seeded: ${categoryCount} categories, ${productCount} products, ${reviewCount} reviews.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Standalone script — nothing else will close the pg Pool, and an open
    // pool keeps the process alive.
    await db.$disconnect();
  });
