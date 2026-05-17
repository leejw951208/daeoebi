// vault 카테고리 URL 필터 파서 단위 테스트.
import { parseCategoryFilter } from './vault-filter';

describe('parseCategoryFilter', () => {
  it('알려진 카테고리 값은 그대로 통과시킨다', () => {
    expect(parseCategoryFilter('BANK')).toBe('BANK');
    expect(parseCategoryFilter('CARD')).toBe('CARD');
    expect(parseCategoryFilter('SECURITIES')).toBe('SECURITIES');
    expect(parseCategoryFilter('SHOPPING')).toBe('SHOPPING');
    expect(parseCategoryFilter('OTHER')).toBe('OTHER');
  });

  it('null·빈 문자열·알 수 없는 값은 ALL 로 fallback 한다', () => {
    expect(parseCategoryFilter(null)).toBe('ALL');
    expect(parseCategoryFilter('')).toBe('ALL');
    expect(parseCategoryFilter('LOGIN')).toBe('ALL');
    expect(parseCategoryFilter('bank')).toBe('ALL');
  });
});
