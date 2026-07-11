// Shared app chrome used by both the real page (bet-log.tsx) and the
// pre-hydration HydrateFallback (root.tsx). Must stay a lightweight leaf
// module — root.tsx renders it before the route bundle loads.

export const FAB_CONTAINER_CLASS =
  "fixed bottom-4 right-4 flex items-end gap-2 z-50";

export const FAB_BASE_CLASS =
  "w-14 h-14 rounded-full shadow-lg border-1 bg-gray-900 border-purple-800";

export function AppTitle() {
  return (
    <div className="w-full h-max text-4xl font-semibold text-center text-purple-200">
      gamba kappachungus deluxe
    </div>
  );
}
