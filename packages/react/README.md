# @ifds/hydration-lens-react

React and Next.js adapter for hydration-lens. It recognizes React hydration warnings and runtime errors, locates the affected DOM element when possible, and displays the shared hydration-lens overlay.

## Install

```bash
npm install --save-dev @ifds/hydration-lens-react
```

## Usage

Call `init()` from a client component rendered near the beginning of your root layout. Do not put it in `useEffect`: React 19 can report hydration errors during the initial synchronous hydrate pass.

```tsx
// app/hydration-lens-init.tsx
"use client";

import { init } from "@ifds/hydration-lens-react";

export function HydrationLensInit() {
  if (process.env.NODE_ENV !== "production") init();
  return null;
}
```

Render `<HydrationLensInit />` as the first child in your root layout. `init(options?)` is safe to call more than once and is a no-op outside the browser. Pass `{ suppressConsole: true }` to suppress recognized framework logging.

Supports React 18 and 19 and Next.js applications. This is a diagnostic tool; it does not fix or change application output.

## License

MIT — see the repository [LICENSE](../../LICENSE).
