-- 카테고리를 고정/사용자 생성으로 분리한다.
-- 고정 = code 보유(수정·삭제 불가), 사용자 생성 = code null. kind 컬럼은 제거한다.
-- 이행 정책: 새 고정 이름과 일치하는 기존 카테고리는 지출 연결을 보존(id 유지),
-- 그 외 카테고리의 지출은 기타(ETC)로 재지정 후 삭제(사용자 생성은 빈 상태로 시작).

-- 1) 기존(사용자 자유입력) 코드를 모두 해제해 고정 코드와의 충돌을 방지한다.
UPDATE "AssetCategory" SET "code" = NULL;

-- 2) 이름이 고정 이름과 일치하는 행에 고정 코드·색을 부여한다(동명이 여럿이면 가장 오래된 1건).
UPDATE "AssetCategory" SET "code" = 'FOOD', "color" = '#f2994a'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '식비' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'CAFE', "color" = '#eb5757'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '카페·간식' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'MART', "color" = '#e0689a'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '편의점·마트' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'SHOPPING', "color" = '#9b6bd6'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '쇼핑' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'HEALTH', "color" = '#7b61ff'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '의료·건강' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'HOUSING', "color" = '#4a90d9'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '주거·통신' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'INSURANCE_TAX', "color" = '#2d9cdb'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '보험·세금' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'BEAUTY', "color" = '#20a4a4'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '미용' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'TRANSPORT', "color" = '#3bb273'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '교통' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'INVESTMENT', "color" = '#6fcf97'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '투자' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'SAVINGS', "color" = '#f2c94c'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '저축' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "AssetCategory" SET "code" = 'ETC', "color" = '#98a0a8'
  WHERE "id" = (SELECT "id" FROM "AssetCategory" WHERE "name" = '기타' ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);

-- 3) 아직 없는 고정 카테고리를 새로 생성한다(id 는 md5 난수, 확장 의존성 없음).
INSERT INTO "AssetCategory" ("id", "name", "color", "code", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), v.name, v.color, v.code, now(), now()
FROM (VALUES
  ('식비', '#f2994a', 'FOOD'),
  ('카페·간식', '#eb5757', 'CAFE'),
  ('편의점·마트', '#e0689a', 'MART'),
  ('쇼핑', '#9b6bd6', 'SHOPPING'),
  ('의료·건강', '#7b61ff', 'HEALTH'),
  ('주거·통신', '#4a90d9', 'HOUSING'),
  ('보험·세금', '#2d9cdb', 'INSURANCE_TAX'),
  ('미용', '#20a4a4', 'BEAUTY'),
  ('교통', '#3bb273', 'TRANSPORT'),
  ('투자', '#6fcf97', 'INVESTMENT'),
  ('저축', '#f2c94c', 'SAVINGS'),
  ('기타', '#98a0a8', 'ETC')
) AS v(name, color, code)
WHERE NOT EXISTS (SELECT 1 FROM "AssetCategory" a WHERE a."code" = v.code);

-- 4) 고정이 아닌(code null) 카테고리의 지출을 기타로 재지정한다(삭제 전 필수 — FK 가 SetNull).
UPDATE "Expense" SET "categoryId" = (SELECT "id" FROM "AssetCategory" WHERE "code" = 'ETC')
  WHERE "categoryId" IN (SELECT "id" FROM "AssetCategory" WHERE "code" IS NULL);
UPDATE "RecurringExpense" SET "categoryId" = (SELECT "id" FROM "AssetCategory" WHERE "code" = 'ETC')
  WHERE "categoryId" IN (SELECT "id" FROM "AssetCategory" WHERE "code" IS NULL);

-- 5) 남은 비고정 카테고리를 삭제한다(사용자 생성 목록은 빈 상태로 시작).
DELETE FROM "AssetCategory" WHERE "code" IS NULL;

-- 6) kind 컬럼 제거.
ALTER TABLE "AssetCategory" DROP COLUMN "kind";
