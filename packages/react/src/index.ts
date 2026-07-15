import type { AdapterOptions } from "hydration-lens-core";
import { defaultBus, mountOverlay } from "hydration-lens-core";
import { reactAdapter } from "./adapter.js";

let installed = false;

/** Call once in a root layout / _app. Dev-only, no-ops outside the browser and on double-init. */
export function init(options?: AdapterOptions): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  reactAdapter.install(defaultBus, options);
  mountOverlay(defaultBus);
}

export { reactAdapter };
export { parseReactWarning, parseReactRuntimeError } from "./adapter.js";
