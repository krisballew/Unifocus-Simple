export interface LoadingSkeletonProps {
  lines?: number;
  avatar?: boolean;
  card?: boolean;
}

export function LoadingSkeleton({ lines = 3, avatar = false, card = false }: LoadingSkeletonProps) {
  return (
    <div className={card ? 'skeleton-card' : 'skeleton'}>
      {avatar && <div className="skeleton-avatar" />}
      <div className="skeleton-body">
        {Array.from({ length: lines }).map((_, index) => (
          <div className="skeleton-line" key={`skeleton-line-${index}`} />
        ))}
      </div>
    </div>
  );
}
