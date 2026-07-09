-- 비밀번호 분류(site-category) 기능 제거. 클라이언트는 더 이상 사용하지 않는다.
-- Secret.categoryId FK/컬럼과 Category 테이블을 제거한다.

-- Secret.categoryId 참조 제거
ALTER TABLE "Secret" DROP CONSTRAINT IF EXISTS "Secret_categoryId_fkey";
DROP INDEX IF EXISTS "Secret_categoryId_idx";
ALTER TABLE "Secret" DROP COLUMN IF EXISTS "categoryId";

-- Category 테이블 제거(자체 인덱스·FK 는 테이블과 함께 삭제된다)
DROP TABLE IF EXISTS "Category";
