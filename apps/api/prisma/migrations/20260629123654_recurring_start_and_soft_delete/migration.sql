/*
  Warnings:

  - Added the required column `startMonth` to the `RecurringExpense` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_recurringId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "removed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable (nullable 추가 → 백필 → NOT NULL 순서로 안전하게 처리)
ALTER TABLE "RecurringExpense" ADD COLUMN "startMonth" TEXT;
UPDATE "RecurringExpense" SET "startMonth" = to_char("createdAt", 'YYYY-MM') WHERE "startMonth" IS NULL;
ALTER TABLE "RecurringExpense" ALTER COLUMN "startMonth" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
