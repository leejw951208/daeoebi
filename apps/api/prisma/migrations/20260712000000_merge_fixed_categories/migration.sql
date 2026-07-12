-- 고정 카테고리 14종 → 11종 병합. 개념을 버리지 않고 남는 카테고리 이름에 합친다.
--   CAFE(카페·간식)  → FOOD(식비·카페)
--   CULTURE(문화)     → SHOPPING(쇼핑·문화)
--   BEAUTY(미용)      → HEALTH(건강·미용)
--   MART              → 이름만 '생활·잡화'로 변경(세탁·수선 등 생활 서비스 포함)
-- Expense/RecurringExpense.categoryId 는 onDelete: SetNull 이므로,
-- 흡수 대상 행을 지우기 전에 참조를 남는 code 로 옮겨야 미분류가 되지 않는다.
-- 런타임 시드(missingFixedCategories)는 누락 code 만 생성하고 기존 행 이름은 갱신하지 않으므로,
-- 이미 시드된 DB 는 이 migration 으로 이름을 맞춘다. 미시드 DB 는 시드 시 새 이름으로 생성된다.

-- 1. 남는 카테고리 이름을 병합된 이름으로 갱신한다.
UPDATE "AssetCategory" SET "name" = '식비·카페', "updatedAt" = now()
  WHERE "code" = 'FOOD';
UPDATE "AssetCategory" SET "name" = '생활·잡화', "updatedAt" = now()
  WHERE "code" = 'MART';
UPDATE "AssetCategory" SET "name" = '쇼핑·문화', "updatedAt" = now()
  WHERE "code" = 'SHOPPING';
UPDATE "AssetCategory" SET "name" = '건강·미용', "updatedAt" = now()
  WHERE "code" = 'HEALTH';

-- 2. 흡수되는 카테고리를 참조하는 지출을 남는 카테고리로 옮긴다.
UPDATE "Expense" e
   SET "categoryId" = t."id", "updatedAt" = now()
  FROM "AssetCategory" src, "AssetCategory" t
 WHERE e."categoryId" = src."id"
   AND (
        (src."code" = 'CAFE'    AND t."code" = 'FOOD')
     OR (src."code" = 'CULTURE' AND t."code" = 'SHOPPING')
     OR (src."code" = 'BEAUTY'  AND t."code" = 'HEALTH')
   );

UPDATE "RecurringExpense" r
   SET "categoryId" = t."id", "updatedAt" = now()
  FROM "AssetCategory" src, "AssetCategory" t
 WHERE r."categoryId" = src."id"
   AND (
        (src."code" = 'CAFE'    AND t."code" = 'FOOD')
     OR (src."code" = 'CULTURE' AND t."code" = 'SHOPPING')
     OR (src."code" = 'BEAUTY'  AND t."code" = 'HEALTH')
   );

-- 3. 흡수된 고정 카테고리 행을 제거한다(참조는 2에서 모두 옮겼다).
DELETE FROM "AssetCategory" WHERE "code" IN ('CAFE', 'CULTURE', 'BEAUTY');
