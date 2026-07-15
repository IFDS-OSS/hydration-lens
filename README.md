# hydration-lens

A dev-only overlay that catches hydration mismatches — in both Next.js and Nuxt — and points at the exact element, prop, or text node that caused them, instead of leaving you to decode a vague console warning.

## The problem

React and Vue both warn when the server-rendered HTML and the client's first render disagree, but neither tells you *where* in a large tree the mismatch actually is. They don't even report it the same way:

**React (Next.js)** — via `console.error`, or (React 19) as a genuinely thrown, uncaught `Error`:

```
Text content did not match. Server: "X" Client: "Y"
```

```
Hydration failed because the server rendered text didn't match the client. As a result this
tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:
  ...
    <Home>
      <Mismatch>
        <p id="mismatch">
+         client-value
-         server-value
```

**Vue (Nuxt)** — via `console.warn`, prefixed `[Vue warn]:`, spread across many positional arguments (the message, the live DOM node, and the component trace are all separate args — not one pre-formatted string):

```
[Vue warn]: Hydration text content mismatch on [node HTMLParagraphElement]
  - rendered on server: server-value
  - expected on client: client-value
  at <Index>
  at <RouteProvider>
  ...
```

hydration-lens intercepts both, in whatever shape your framework/version actually emits, and turns them into one consistent, located issue: a badge with a count, a panel with the details, and a "Locate" button that scrolls to and highlights the real element.

Because the warning shapes are framework-specific but the underlying problem (mismatch → locate → highlight) isn't, the tool is a framework-agnostic core (`hydration-lens-core`) plus a thin adapter per framework.

## Install

```bash
# React / Next.js
npm install --save-dev hydration-lens-react

# Vue
npm install --save-dev hydration-lens-vue

# Nuxt (wraps hydration-lens-vue, zero-config)
npm install --save-dev hydration-lens-nuxt
```

## Usage — React / Next.js

`hydration-lens-react` has no module system to hook into, so you call `init()` yourself.

**Important:** call it directly in a Client Component's render body, not inside `useEffect`. React 19 can throw hydration-mismatch errors *synchronously during the initial hydrate pass* — before any component's effects run — so a `useEffect`-based `init()` attaches its listeners after the error has already happened and been lost. A bare side-effect import doesn't work either: Next's Server/Client boundary compiler only bundles a `"use client"` module for the bindings a Server Component actually renders, so an import with nothing used from it gets dropped from the client bundle entirely.

```tsx
// app/hydration-lens-init.tsx
"use client";

import { init } from "hydration-lens-react";

export function HydrationLensInit() {
  if (process.env.NODE_ENV !== "production") init();
  return null;
}
```

```tsx
// app/layout.tsx
import { HydrationLensInit } from "./hydration-lens-init";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HydrationLensInit />
        {children}
      </body>
    </html>
  );
}
```

Render `<HydrationLensInit />` as the *first* child so it hydrates before the rest of the tree, in the same synchronous pass.

`init(options?)` is a no-op outside the browser and on a second call. It never swallows console output — pass `{ suppressConsole: true }` to also suppress the original `console.error`/uncaught-error logging for warnings it recognized (unrelated errors are always still logged).

## Usage — Nuxt

Zero-config: add the module, nothing else.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["hydration-lens-nuxt"],
});
```

This registers a dev-only client plugin that calls the Vue adapter's `init()` on app mount, guarded on `nuxt.options.dev` so it's tree-shaken out of production builds entirely.

## Usage — plain Vue (no Nuxt)

```ts
import { init } from "hydration-lens-vue";

if (import.meta.env.DEV) init();
```

Same `init(options?)` contract as the React adapter.

## Issue kinds

| Kind | Meaning |
| --- | --- |
| `text` | A text node's content differs between server and client render. |
| `node` | An element's tag differs (e.g. server rendered a `<span>` where the client expected a `<div>`). |
| `children` | The number/shape of child nodes differs between server and client. |
| `unknown` | A hydration-related warning was caught but didn't match a known shape closely enough to extract expected/actual values — still surfaced with the raw message, never silently dropped. |

Each issue also carries a `componentTrail` (the component stack both frameworks report, just formatted differently) and, when locatable, a confidence level:

- **exact** — either the framework handed us a live DOM node/vnode directly (Vue does this for node mismatches), or a text search found exactly one match.
- **heuristic** — multiple candidates matched by text/tag; narrowed to one using the component trail.
- **none** — couldn't confidently locate it. The overlay disables "Locate" rather than pointing at the wrong element.

## Limitations

- **React 18/19 and Vue 3 / Nuxt 3–4 only.** No Vue 2 / Nuxt 2 — the hydration internals are entirely different.
- **No Svelte/SvelteKit support yet.** The `Adapter` interface (`packages/core/src/types.ts`) is already structured to add one later.
- **Locating is heuristic, not exact science.** For duplicate/ambiguous text or a target whose content itself keeps changing between when the warning fired and when you click "Locate" (as with a demo seeded by `Math.random()` inside a Client Component that gets remounted during hydration recovery), the tool correctly reports "not found" rather than guessing.
- **Diagnostic only.** This does not fix mismatches or modify your app's output — it only locates and displays them.

## Demos

Two runnable demos reproduce a real, seeded hydration mismatch end-to-end:

```bash
pnpm dev:next-demo   # demo/next-demo — App Router, hydration-lens-react
pnpm dev:nuxt-demo   # demo/nuxt-demo — Nuxt 3, hydration-lens-nuxt
```

Open the printed local URL, check the console for the framework's own warning, and look for the "Hydration issues" badge in the bottom-right corner.

## Development

```bash
pnpm install
pnpm build       # builds packages/{core,react,vue,nuxt}
pnpm typecheck   # tsc --noEmit across every package
pnpm test        # vitest across test/
```

## Roadmap

Not built yet, but the architecture leaves room for it:

- A browser extension wrapping the shared core, framework-detecting at runtime.
- A side-by-side visual diff of expected vs. actual DOM, instead of just a highlight.

## Structure and Architecture

For this matter, you may read [this file](STRUCTURE-AND-ARCHITECTURE.md).

## Contributing

Issues and PRs welcome — this is maintained under IFDS. Keep framework-specific parsing inside `packages/react` or `packages/vue`; `packages/core` should stay framework-agnostic.

## License

MIT — see [LICENSE](LICENSE).
