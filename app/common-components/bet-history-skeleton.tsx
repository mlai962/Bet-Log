/**
 * Pulsing placeholder for the bet history list, shaped like the real
 * tile column so first paint doesn't shift layout when data arrives.
 */
export default function BetHistorySkeleton() {
  return (
    <div role="status" className="w-full h-max flex justify-center">
      <div className="w-[22rem] max-w-full space-y-1 flex flex-col animate-pulse">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="h-28 rounded-lg border-1
            bg-gray-400 dark:bg-purple-950/10
            border-purple-500/50 dark:border-purple-700/50"
          />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
