# @ifds/hydration-lens-core

Framework-agnostic foundation for hydration-lens. It provides the shared hydration issue model, issue bus, DOM locator, and in-browser overlay used by the React and Vue adapters.

This package is usually installed indirectly through a framework adapter:

```bash
npm install --save-dev @ifds/hydration-lens-react
npm install --save-dev @ifds/hydration-lens-vue
```

Use the core directly only when building another framework adapter or integrating hydration diagnostics yourself. The public API includes `createIssueBus`, `locate`, `describeElement`, and `mountOverlay`, along with the shared TypeScript types.

## License

MIT — see the repository [LICENSE](../../LICENSE).
