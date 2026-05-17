// UI/UX 재검증에서 발견된 OPEN 항목의 보강 상태를 회귀 방지한다.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = join(__dirname, '..');

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), 'utf8');
}

describe('ui-ux-redesign OPEN item patches', () => {
  it('manifest 가 참조하는 PWA PNG 아이콘 파일 3개가 존재한다', () => {
    for (const filename of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
      expect(existsSync(join(projectRoot, 'public/icons', filename))).toBe(true);
    }
  });

  it('CategoryForm 과 OccurrencePanel 이 모바일 bottom-sheet 클래스를 사용한다', () => {
    const categoryForm = readProjectFile('app/vault/CategoryForm.tsx');
    const occurrencePanel = readProjectFile('components/OccurrencePanel.tsx');
    const css = readProjectFile('app/globals.css');

    expect(categoryForm).toContain('inline-bottom-sheet');
    expect(occurrencePanel).toContain('inline-bottom-sheet');
    expect(css).toContain('.inline-bottom-sheet');
    expect(css).toContain('position: sticky');
  });

  it('desktop body 배경은 zinc 토큰을 사용한다', () => {
    const css = readProjectFile('app/globals.css');

    expect(css).toContain('--color-bg-outer: #e4e4e7;');
    expect(css).toContain('background: var(--color-bg-outer);');
    expect(css).not.toContain('background: #e4e4e7;');
  });
});
