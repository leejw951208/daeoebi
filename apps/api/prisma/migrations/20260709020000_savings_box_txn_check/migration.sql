-- SavingsBoxTxn.type/source 에 DB 레벨 무결성 제약을 추가한다.
-- 앱 경계(@IsIn)에서만 검증되던 값을 DB CHECK 로도 보장한다. 기존 행은 모두 부합.
ALTER TABLE "SavingsBoxTxn"
  ADD CONSTRAINT "SavingsBoxTxn_type_check" CHECK ("type" IN ('in', 'out'));
ALTER TABLE "SavingsBoxTxn"
  ADD CONSTRAINT "SavingsBoxTxn_source_check" CHECK ("source" IN ('cash', 'savings'));
