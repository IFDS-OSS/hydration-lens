import type { AdapterOptions } from "@ifds/hydration-lens-core";
import { defaultBus, mountOverlay } from "@ifds/hydration-lens-core";
import { vueAdapter } from "./adapter.js";

let installed = false;

/** Call once on app mount. Dev-only, no-ops outside the browser and on double-init. */
export function init(options?: AdapterOptions): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  vueAdapter.install(defaultBus, options);
  mountOverlay(defaultBus);
}

export { vueAdapter };
export { parseVueWarning } from "./adapter.js";
