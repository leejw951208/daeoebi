'use client';
// vault 카테고리 메타 reference 라우트.
// 현 회차는 API 변경 금지 제약(spec 참조) 으로 카테고리 정의가 코드 상수이며 사용자 추가/수정/삭제는 불가하다.
// 본 페이지는 카테고리 별 필드 구성과 민감도를 한 화면에서 확인하는 reference 뷰를 제공한다.
import Link from 'next/link';
import { type VaultCategory } from '@/lib/vault-client';
import { CATEGORY_FIELDS, CATEGORY_LABELS } from '../category-schema';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as VaultCategory[];

export default function VaultCategoriesPage() {
  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>카테고리</h1>
        <Link className="btn secondary" href="/vault">← 보관함</Link>
      </header>

      <p className="muted" style={{ marginTop: 8 }}>
        카테고리 정의는 코드 상수입니다. 신규 카테고리는 다음 회차에서 검토합니다.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {CATEGORIES.map((cat) => {
          const fields = CATEGORY_FIELDS[cat] ?? [];
          return (
            <section key={cat} className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {CATEGORY_LABELS[cat]} <span className="muted">({cat})</span>
              </h2>
              {fields.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  {cat === 'OTHER'
                    ? '사용자 정의 key-value 쌍(최대 10개) 으로 자유롭게 채울 수 있습니다.'
                    : '필드 없음.'}
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                  {fields.map((f) => (
                    <li key={f.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{f.label}</span>
                      <span className="muted">{f.sensitive ? '민감 · ' : ''}{f.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
