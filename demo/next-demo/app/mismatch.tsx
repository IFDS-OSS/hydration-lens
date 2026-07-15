"use client";

/**
 * A Client Component so this render function genuinely runs twice — once during SSR,
 * once again during client hydration. A plain Server Component only renders once (its
 * HTML output is hydrated as-is, never re-executed), so it can't produce a real mismatch
 * in the App Router the way it could under the old Pages Router's always-hydrated model.
 *
 * `typeof window` rather than Math.random(): when React can't reconcile a mismatch it
 * remounts the subtree client-side from scratch, sometimes more than once while settling.
 * A Math.random() seed recomputes to a *new* value on every one of those remounts, so by
 * the time a user clicks "Locate" the DOM has already drifted past the value the original
 * warning reported. `typeof window !== "undefined"` is deterministic per environment —
 * always "false" server-side, always "true" client-side — so every remount converges back
 * to the exact same client value the hydration warning captured.
 */
export function Mismatch() {
  return <p id="mismatch">{String(typeof window !== "undefined")}</p>;
}
