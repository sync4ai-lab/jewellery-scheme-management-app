'use client';

type CustomerLoadingSkeletonProps = {
  title?: string;
  withGrid?: boolean;
};

export function CustomerLoadingSkeleton({ title = 'Loading...', withGrid = true }: CustomerLoadingSkeletonProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 via-white to-gold-100">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-full bg-gold-200/60" />
          <div className="h-4 w-64 rounded-full bg-gold-100/70" />
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

        {withGrid && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-white/70 border border-gold-100" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="h-4 w-full rounded-full bg-gold-100/70" />
          <div className="h-4 w-5/6 rounded-full bg-gold-100/60" />
          <div className="h-4 w-4/6 rounded-full bg-gold-100/50" />
        </div>
      </div>
    </div>
  );
}
