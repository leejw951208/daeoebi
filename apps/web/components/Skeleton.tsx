// fetch 중 화면 공백을 채우는 skeleton 로더.
interface SkeletonProps {
  height?: number;
  width?: string | number;
  className?: string;
}

export function Skeleton({ height = 14, width = '100%', className }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className ?? ''}`.trim()}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="skeleton-card" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
