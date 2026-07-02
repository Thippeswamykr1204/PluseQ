export const SkeletonLine = ({ className = "" }) => <div className={`skeleton h-4 ${className}`} />;

export const SkeletonCard = () => (
  <div className="card p-5 space-y-3">
    <SkeletonLine className="w-1/2" />
    <SkeletonLine className="w-full" />
    <SkeletonLine className="w-2/3" />
  </div>
);

export const SkeletonRow = () => (
  <div className="card p-4 flex items-center gap-4">
    <div className="skeleton h-10 w-10 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-1/4" />
    </div>
    <div className="skeleton h-8 w-20 rounded-lg" />
  </div>
);
