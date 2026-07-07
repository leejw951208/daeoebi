-- CreateTable
CREATE TABLE "SavingsBoxTxn" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "iv" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsBoxTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsBoxTxn_date_idx" ON "SavingsBoxTxn"("date");
