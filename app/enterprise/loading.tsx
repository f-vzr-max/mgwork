// Skeleton shown by Next.js while the enterprise dashboard page streams in.

export default function EnterpriseDashboardLoading() {
  return (
    <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 90,
              borderRadius: 10,
              background: "hsl(var(--surface-2))",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
      {/* Feed + rail skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
        <div
          style={{
            height: 420,
            borderRadius: 10,
            background: "hsl(var(--surface-2))",
            opacity: 0.5,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              height: 200,
              borderRadius: 10,
              background: "hsl(var(--surface-2))",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              height: 180,
              borderRadius: 10,
              background: "hsl(var(--surface-2))",
              opacity: 0.5,
            }}
          />
        </div>
      </div>
    </div>
  );
}
