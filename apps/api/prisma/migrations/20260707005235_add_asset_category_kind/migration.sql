-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'NORMAL';
-- 기존 시드 저축/투자 데이터 마커 지정
UPDATE "AssetCategory" SET "kind" = 'SAVINGS' WHERE "name" = '저축';
UPDATE "AssetCategory" SET "kind" = 'INVESTMENT' WHERE "name" = '투자';
