-- DropIndex
DROP INDEX "Category_label_idx";

-- DropIndex
DROP INDEX "Category_siteId_idx";

-- DropIndex
DROP INDEX "Expense_date_idx";

-- DropIndex
DROP INDEX "RecurringExpense_active_idx";

-- DropIndex
DROP INDEX "Secret_label_idx";

-- DropIndex
DROP INDEX "Secret_siteId_idx";

-- CreateIndex
CREATE INDEX "Category_siteId_label_idx" ON "Category"("siteId", "label");

-- CreateIndex
CREATE INDEX "Expense_removed_date_idx" ON "Expense"("removed", "date");

-- CreateIndex
CREATE INDEX "RecurringExpense_active_createdAt_idx" ON "RecurringExpense"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Secret_siteId_label_idx" ON "Secret"("siteId", "label");
