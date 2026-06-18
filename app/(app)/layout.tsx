/**
 * Layout for the (future) Counder Connect product surface. Placeholder shell —
 * auth gating, nav, and realtime providers plug in here. The marketing home at
 * `app/page.tsx` is intentionally outside this group.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100svh] bg-white text-black">{children}</div>;
}
