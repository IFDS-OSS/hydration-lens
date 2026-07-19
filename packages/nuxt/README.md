# @ifds/hydration-lens-nuxt

Zero-config Nuxt module for hydration-lens. In development, it registers a client plugin that initializes the Vue adapter and mounts the hydration issue overlay. It is disabled for production builds.

## Install

```bash
npm install --save-dev @ifds/hydration-lens-nuxt
```

## Usage

Add the module to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ["@ifds/hydration-lens-nuxt"],
});
```

The optional `hydrationLens.suppressConsole` setting is available for suppressing recognized Vue warning output:

```ts
export default defineNuxtConfig({
  modules: ["@ifds/hydration-lens-nuxt"],
  hydrationLens: { suppressConsole: true },
});
```

Supports Nuxt 3 and 4 with Vue 3. This is a diagnostic tool; it does not fix hydration mismatches.

## License

MIT — see the repository [LICENSE](../../LICENSE).
