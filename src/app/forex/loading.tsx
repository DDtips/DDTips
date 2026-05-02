export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-32 md:pt-40 pb-32 md:pb-12 px-4">
      <div className="max-w-[1800px] mx-auto">
        {/* Header skeleton */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
            <div className="h-3 w-32 bg-emerald-500/10 rounded animate-pulse" />
          </div>
          <div className="h-12 w-64 bg-zinc-900 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-96 bg-zinc-900 rounded animate-pulse" />
        </div>

        {/* Cards skeletons */}
        <div className="space-y-5 md:space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="relative bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6 md:p-8 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 animate-pulse" />
                <div>
                  <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse mb-2" />
                  <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-28 bg-black/40 rounded-xl border border-white/5 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
