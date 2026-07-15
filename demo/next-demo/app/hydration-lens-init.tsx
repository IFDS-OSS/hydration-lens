"use client";

import { init } from "hydration-lens-react";

/**
 * init() is called directly in the render body, not inside useEffect: React 19 throws
 * hydration-mismatch errors synchronously during the initial hydrate pass, which runs
 * before any component's effects fire — a useEffect-based init() attaches its listeners
 * only after the error has already been thrown and lost.
 *
 * A bare side-effect import (`import "./hydration-lens-init"` with nothing used from it)
 * doesn't work either: Next's Server/Client boundary compiler only includes a "use client"
 * module in the browser bundle for the specific bindings a Server Component actually
 * renders, so an unused import gets dropped entirely. Rendering <HydrationLensInit />
 * as the first child in the tree (see layout.tsx) guarantees both: Next includes the
 * module, and React invokes this function — during the same synchronous hydrate pass,
 * before later siblings like the seeded <Mismatch /> are reached.
 */
export function HydrationLensInit() {
  if (process.env.NODE_ENV !== "production") init();
  return null;
}
