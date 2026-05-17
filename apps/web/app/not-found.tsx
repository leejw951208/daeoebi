// 글로벌 404. 잘못된 라우트 진입 시 한국어 안내와 홈 복귀 링크를 제공한다.
import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="container" style={{ display: 'grid', gap: 16, paddingTop: 32 }}>
      <h1 style={{ margin: 0 }}>페이지를 찾을 수 없습니다</h1>
      <p className="muted">요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.</p>
      <div>
        <Link className="btn" href="/">
          홈으로
        </Link>
      </div>
    </section>
  );
}
