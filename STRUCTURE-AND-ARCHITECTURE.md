# hydration-lens — Structure & Architecture

## Project tree

```
hydration-lens/
├── package.json                  # workspace root (private) — build/typecheck/test/dev scripts
├── pnpm-workspace.yaml           # packages/* + demo/* workspace members
├── tsconfig.base.json            # shared strict TS config, extended by every package
├── vitest.config.ts              # root test runner config (node env by default, jsdom for DOM-dependent tests)
├── LICENSE                       # MIT, applies to all packages
├── README.md
│
├── packages/
│   ├── core/                     # "hydration-lens-core" — framework-agnostic
│   │   ├── src/
│   │   │   ├── types.ts          # HydrationIssue, Adapter, IssueBus, LocateResult
│   │   │   ├── bus.ts            # createIssueBus() — Set-backed pub/sub, defaultBus singleton
│   │   │   ├── locator.ts        # locate(issue) — DOM search heuristics, describeElement()
│   │   │   ├── overlay.ts        # mountOverlay(bus) — shadow-DOM badge + panel UI
│   │   │   └── index.ts          # public exports
│   │   ├── tsup.config.ts        # esm+cjs+dts build
│   │   └── package.json
│   │
│   ├── react/                    # "hydration-lens-react"
│   │   ├── src/
│   │   │   ├── adapter.ts        # console.error patch + window 'error' listener; React warning/thrown-Error parsers
│   │   │   └── index.ts          # init() — dev-only, browser-only, idempotent
│   │   └── package.json          # react = optional peerDependency (never actually imported)
│   │
│   ├── vue/                      # "hydration-lens-vue"
│   │   ├── src/
│   │   │   ├── adapter.ts        # console.warn patch; multi-arg Vue warning parser
│   │   │   └── index.ts          # init(), same contract as react adapter
│   │   └── package.json          # vue = optional peerDependency
│   │
│   └── nuxt/                     # "hydration-lens-nuxt" — depends on hydration-lens-vue
│       ├── src/
│       │   ├── module.ts         # defineNuxtModule — registers dev-only client plugin
│       │   └── runtime/
│       │       └── plugin.client.ts  # calls hydration-lens-vue's init() on app mount
│       └── package.json          # built via @nuxt/module-builder (unbuild), not tsup
│
└── test/
    ├── locator.test.ts           # jsdom — TreeWalker-based DOM search
    ├── react-adapter.test.ts     # jsdom — includes real captured React 19 warning strings
    └── vue-adapter.test.ts       # node   — includes real captured Vue 3.5 warning args
```

## The core idea

React and Vue both detect hydration mismatches internally, and both eventually surface them, but through different mechanisms, different console methods, and message shapes that drift between versions. All the framework-specific parsing stays quarantined inside `packages/react` and `packages/vue`. Everything downstream of "here is a mismatch" (the data model, the DOM search, the UI) lives in `packages/core` and knows nothing about React or Vue.

```
console.error / console.warn / window 'error' event
              │
              ▼
   ┌─────────────────────┐
   │  adapter.ts          │  framework-specific: pattern-match the warning,
   │  (react | vue)       │  extract expected/actual/componentTrail
   └─────────┬────────────┘
             │  bus.emit(HydrationIssue)
             ▼
   ┌─────────────────────┐
   │  bus.ts (core)        │  Set<listener>, no framework knowledge
   └─────────┬────────────┘
             │  subscribe callback
             ▼
   ┌─────────────────────┐
   │  overlay.ts (core)    │  renders badge/panel, calls locate() on demand
   └─────────┬────────────┘
             │  user clicks "Locate"
             ▼
   ┌─────────────────────┐
   │  locator.ts (core)    │  TreeWalker search of the *current* DOM
   └─────────────────────┘
```

## Adapter interception mechanism

Each adapter's `install(bus, options)` patches exactly one console method. It always forwards to the original console call (it only swallows output when the specific hydration warning was recognized *and* `suppressConsole: true` is set), and it returns a teardown function. Neither adapter imports its target framework: `react`/`react-dom` and `vue` are optional peer dependencies, referenced only in type comments and docs.

**React (`packages/react/src/adapter.ts`)** patches two things, because React reports hydration problems two different ways depending on version and severity:

1. `console.error`, for warnings logged with an un-interpolated format string plus positional args (`console.error("...%s...", serverText, clientText)`). Regexes match the *format string* itself, not a pre-substituted message, then map values positionally.
2. `window.addEventListener('error', ...)`, because React 19's more severe hydration failures show up as a genuinely thrown, uncaught `Error` (confirmed against a real Next.js 15 / React 19 repro: the message is a JSX-tree-shaped diff with `+`/`-` lines for client/server values, not a `console.error` call at all). Skipping this path means missing the most common real-world case.

**Vue (`packages/vue/src/adapter.ts`)** patches `console.warn`. An earlier design assumed Vue's `warn()` hands `console.warn` one pre-formatted string; a real Vue 3.5/Nuxt 3 repro corrected that. Vue instead spreads the message text, the live DOM node or vnode (a real object reference, not a string), and the component trace across many positional arguments. The adapter joins every string-typed argument to reconstruct one message for regex matching, and separately scans the raw argument list for anything `instanceof Node`. When it finds one, that becomes the issue's `liveNode`, which gives the locator an `exact`-confidence match for free, with no `TreeWalker` search needed.

Both adapters also handle drift defensively: if a message matches `/hydrat/i` but doesn't match any known specific shape, it's still emitted as `kind: 'unknown'` with the raw message intact, rather than dropped just because wording shifted between framework versions.

## Data model (`packages/core/src/types.ts`)

`HydrationIssue` is the single shape both adapters normalize into: `id`, `timestamp`, `framework` (`'react' | 'vue'`), `kind` (`'text' | 'node' | 'children' | 'unknown'`), `rawMessage`, `expected`/`actual` (nullable, since these aren't always parseable), `componentTrail` (an array of `{name, raw}`), `targetSelectorGuess` (display-only, filled in lazily after a successful locate), and an optional `liveNode` for the Vue live-reference shortcut.

`IssueBus` stays deliberately minimal: a `Set<listener>` wrapped in `emit`/`subscribe`. There's only one event type, so a full EventEmitter would add generality nobody needs.

## Locating (`packages/core/src/locator.ts`)

`locate(issue)` runs lazily, when a user clicks "Locate," not eagerly at warn-time, because a hydration warning can fire mid-patch, before the DOM has settled into its final state. The search proceeds in order, and each step only runs if the previous one didn't produce a unique answer:

1. **Live node** (`issue.liveNode`): if the framework handed us a real reference (Vue only), use it directly. `confidence: 'exact'`.
2. **Text search** (`kind: 'text'`): `TreeWalker(SHOW_TEXT)` over `document.body` for nodes whose trimmed text equals `issue.actual`. One match wins outright as `exact`. Multiple matches get narrowed by checking whether any ancestor's tag name or `data-*` attribute value contains `componentTrail[0].name`; if that narrows to one, it's `heuristic`.
3. **Element search** (`kind: 'node'`): same idea with `TreeWalker(SHOW_ELEMENT)`, matching by tag name.
4. Anything still unresolved returns `{confidence: 'none', element: null}`. The overlay disables "Locate" rather than guessing, carrying over the original design principle: mark unlocatable rather than guess wrong.

`describeElement()` produces a human-readable label (`#id` or `tag:nth-of-type(n)`) for display only. It's never used to re-query the DOM, so it can't go stale.

## Overlay (`packages/core/src/overlay.ts`)

Vanilla DOM, mounted into a shadow root so host-page CSS can't leak in or out. Two behaviors are worth calling out because both surfaced through real-browser testing, not from assumption:

- **Self-healing mount.** `ensureMounted()` runs at the top of every `render()` call, not just once. React and Vue can discard and regenerate an entire DOM subtree client-side right after detecting a mismatch, and if that regenerated region is or contains `document.body`, a naively-mounted overlay gets wiped out with it. Re-checking `document.body.contains(host)` on every render and recreating the host if it's gone lets the overlay survive that regeneration instead of silently vanishing after the first render.
- **Event delegation.** One click listener sits on the panel root (keyed off `data-action`/`data-issue-id`) instead of one per row, which avoids rebinding listeners every time the issue list re-renders.

## Nuxt module (`packages/nuxt`)

This is the one place React and Nuxt genuinely diverge in packaging. `defineNuxtModule` registers a dev-only client plugin via `addPlugin`, guarded twice: once in `setup()` on `nuxt.options.dev`, and again in the plugin body via `import.meta.dev`, so it's dead-code-eliminated from production bundles even if one guard were ever bypassed. It's built with `@nuxt/module-builder` (which wraps `unbuild`) rather than `tsup`, because it needs to copy `runtime/` and generate the dual module/type entries Nuxt's module convention expects.

## Testing strategy

- `test/locator.test.ts`: jsdom, exercises the `TreeWalker` search paths against real DOM fixtures built with `innerHTML`.
- `test/react-adapter.test.ts`: jsdom (needs `window`/`ErrorEvent` for the thrown-Error path). Includes a table of synthetic warning shapes plus a verbatim string captured from a real React 19.0/Next.js 15.5 repro, so the parser is checked against what the framework actually emits, not just what the spec assumed it would.
- `test/vue-adapter.test.ts`: node environment (no DOM needed; `instanceof Node` checks are guarded and separately tested via `vi.stubGlobal`). Includes both the original documented warning shape (kept as a fallback pattern) and the real multi-argument array captured from a Vue 3.5.39/Nuxt 3.21 repro.

Every test file trades some "what if the framework changes wording again" risk for "this is what actually happens today" confidence. That trade was deliberate: two of the three adapter bugs this project hit only existed in the wild, never in a spec.