-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL,
    "iv" BYTEA NOT NULL, "ciphertext" BYTEA NOT NULL, "authTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);
