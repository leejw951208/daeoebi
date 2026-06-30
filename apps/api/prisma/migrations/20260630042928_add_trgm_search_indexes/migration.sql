-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Category_label_trgm_idx" ON "Category" USING GIN ("label" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Secret_label_trgm_idx" ON "Secret" USING GIN ("label" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Site_label_trgm_idx" ON "Site" USING GIN ("label" gin_trgm_ops);
