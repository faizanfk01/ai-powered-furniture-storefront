-- Adds the R2 object key to ProductImage.
--
-- NOT NULL with no default is safe here: ProductImage is empty (0 rows,
-- verified against the dev database before generating this), and no code path
-- has ever written to it. If that were not true this would need a nullable
-- column, a backfill and a follow-up SET NOT NULL.

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_key_key" ON "ProductImage"("key");
