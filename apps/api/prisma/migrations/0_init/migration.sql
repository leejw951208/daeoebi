-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "VaultMaster" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "kdfVersion" INTEGER NOT NULL DEFAULT 1,
    "kdfAlgorithm" TEXT NOT NULL DEFAULT 'argon2id',
    "kdfMemoryKiB" INTEGER NOT NULL DEFAULT 65536,
    "kdfIterations" INTEGER NOT NULL DEFAULT 3,
    "kdfParallelism" INTEGER NOT NULL DEFAULT 1,
    "salt" BYTEA NOT NULL,
    "verifyIv" BYTEA NOT NULL,
    "verifyCiphertext" BYTEA NOT NULL,
    "verifyAuthTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iv" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "kdfVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEntry_category_idx" ON "VaultEntry"("category");

-- CreateIndex
CREATE INDEX "VaultEntry_label_idx" ON "VaultEntry"("label");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntry_category_label_key" ON "VaultEntry"("category", "label");

