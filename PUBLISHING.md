# Publishing to npm

This publishes the four library packages only: `hydration-lens-core`,
`hydration-lens-react`, `hydration-lens-vue`, `hydration-lens-nuxt`. The
`demo/` folder is a separate, `"private": true` workspace member and is
never touched by any of this — it isn't in the dependency graph of any
published package and each package's `"files": ["dist"]` field means only
built output ships, never `src/`, configs, or demos.

## Order matters

`hydration-lens-react`, `hydration-lens-vue`, and `hydration-lens-nuxt` all
depend on `hydration-lens-core` (or on `hydration-lens-vue`, in nuxt's case)
via `workspace:*`. pnpm rewrites that to the real version number **only if
the dependency is already published at that version**, so:

```
1. hydration-lens-core
2. hydration-lens-react   (depends on core)
   hydration-lens-vue     (depends on core)
3. hydration-lens-nuxt    (depends on vue)
```

react and vue can be published in either order relative to each other, but
both must come after core, and nuxt must come after vue.

## One-time setup

```bash
npm login
```

Verify you're logged in as the right account/org member:

```bash
npm whoami
```

All four package names are currently unclaimed on the registry, so the
first publish of each will create it — no need to reserve names separately.

## ⚠️ Always dry-run/publish from inside a package directory

Run `npm pack --dry-run` (or `npm publish`) from **inside a package**
(`packages/core`, `packages/react`, `packages/vue`, `packages/nuxt`) — never
from the repo root.

The root `package.json` is `"private": true`, which correctly blocks `npm
publish` from the root outright. But `npm pack` does **not** respect
`private`, so running it at the repo root builds a tarball of the entire
monorepo — including `demo/`, `test/`, every package's `src/`, and configs.
That tarball is harmless (it can never actually be published, since
`private: true` still blocks `npm publish`), but it looks alarming and is
not what gets shipped. If you see `demo/` in a pack listing, check you're
not accidentally standing in the repo root:

```bash
pwd   # should be .../hydration-lens/packages/<name>, not .../hydration-lens
```

Each individual package's own `package.json` has `"files": ["dist"]`, which
is the actual, enforced allowlist — confirmed by dry-run below to contain
only `dist/**` and `package.json`, nothing from `src/` or `demo/`.

## Pre-publish checks

Run the full verification suite once before publishing anything:

```bash
cd /home/berlin/Documents/IFDS/hydration-lens
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

All should pass (4/4 package builds, 4/4 typechecks, 37/37 tests). Also
sanity-check exactly what would be uploaded, per package, before you commit
to publishing:

```bash
cd packages/core && npm pack --dry-run
cd ../react       && npm pack --dry-run
cd ../vue         && npm pack --dry-run
cd ../nuxt        && npm pack --dry-run
```

Confirm the file list for each is just `dist/**`, `package.json`,
`README.md`/`LICENSE` if present at the package root — nothing from
`src/`, `demo/`, or the repo root leaking in.

## Publish

Each package's `dist/` is a build artifact (gitignored) so rebuild fresh
right before publishing:

```bash
cd /home/berlin/Documents/IFDS/hydration-lens
pnpm build
```

Then publish in dependency order. All four are scoped-free plain names, so
no `--access public` is strictly required, but pass it anyway since it's
the correct flag for any *new* unscoped-or-scoped public package and is a
no-op if not needed:

```bash
cd packages/core
npm publish --access public

cd ../react
npm publish --access public

cd ../vue
npm publish --access public

cd ../nuxt
npm publish --access public
```

If you'd rather not `cd` around, pnpm's workspace filter does the same
thing from the repo root:

```bash
pnpm --filter hydration-lens-core publish --access public
pnpm --filter hydration-lens-react publish --access public
pnpm --filter hydration-lens-vue publish --access public
pnpm --filter hydration-lens-nuxt publish --access public
```

## Verify

```bash
npm view hydration-lens-core version
npm view hydration-lens-react version
npm view hydration-lens-vue version
npm view hydration-lens-nuxt version
```

Each should report `0.1.0`. Then do a clean-room install smoke test,
outside the repo, to confirm the published tarballs actually work
standalone (not just via the pnpm workspace's local linking):

```bash
mkdir -p /tmp/hl-smoke && cd /tmp/hl-smoke
npm init -y
npm install hydration-lens-react
node -e "require('hydration-lens-react')" # or check dist/index.cjs exports
```

## Releasing a new version later

Bump the version in the relevant package(s) (and in any dependent package's
`workspace:*` reference stays `workspace:*` — pnpm handles the rewrite at
publish time, you don't hand-edit it) then repeat the same
build → dependency-ordered publish sequence above. Tag the release in git
so the npm version and the GitHub tag stay in sync:

```bash
git tag v0.1.0
git push origin v0.1.0
```
