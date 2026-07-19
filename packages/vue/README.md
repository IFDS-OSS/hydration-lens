# @ifds/hydration-lens-vue

Vue 3 adapter for hydration-lens. It recognizes Vue hydration warnings, extracts the mismatch details, locates the affected DOM element when possible, and displays the shared overlay.

## Install

```bash
npm install --save-dev @ifds/hydration-lens-vue
```

## Usage

Call `init()` on the client during app startup:

```ts
import { init } from "@ifds/hydration-lens-vue";

if (import.meta.env.DEV) init();
```

`init(options?)` is safe to call more than once and is a no-op outside the browser. Pass `{ suppressConsole: true }` to suppress recognized Vue warning output.

Supports Vue 3. For Nuxt, use [`@ifds/hydration-lens-nuxt`](../nuxt) for zero-config setup.

## License

MIT — see the repository [LICENSE](../../LICENSE).
