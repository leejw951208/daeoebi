-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_code_key" ON "AssetCategory"("code");
