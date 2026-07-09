-- 편의점·마트 카테고리에 잡화를 흡수해 이름을 '편의점·마트·잡화'로 병합한다.
-- 고정 code(MART)와 색은 그대로 두고 표시 이름만 바꾼다.
-- 런타임 시드(missingFixedCategories)는 누락 code 만 생성하고 기존 행 이름은 갱신하지 않으므로,
-- 이미 시드된 DB 는 이 migration 으로 이름을 맞춘다. 미시드 DB 는 시드 시 새 이름으로 생성된다.
UPDATE "AssetCategory" SET "name" = '편의점·마트·잡화', "updatedAt" = now()
  WHERE "code" = 'MART';
