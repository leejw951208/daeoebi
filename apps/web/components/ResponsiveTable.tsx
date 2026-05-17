// 모바일에서 테이블을 카드 stack 으로 전환하는 컴포넌트.
import type { ReactNode } from 'react';

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** 모바일 카드에서 라벨을 숨기고 큰 글씨로 표시 (예: 이름) */
  primary?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
}

export function ResponsiveTable<T>({ rows, columns, rowKey }: Props<T>) {
  return (
    <div className="responsive-table">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.align === 'right' ? { textAlign: 'right' } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} style={col.align === 'right' ? { textAlign: 'right' } : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="responsive-table-cards">
        {rows.map((row) => (
          <div key={rowKey(row)} className="responsive-table-card">
            {columns.map((col) => (
              <div key={col.key} className="responsive-table-card-row">
                {!col.primary && <span className="responsive-table-card-label">{col.header}</span>}
                <span style={{ fontWeight: col.primary ? 600 : 400 }}>{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
