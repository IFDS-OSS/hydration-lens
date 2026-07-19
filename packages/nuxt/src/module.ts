import { defineNuxtModule, addPlugin, createResolver } from "@nuxt/kit";
import type { NuxtModule } from "@nuxt/schema";

export interface ModuleOptions {
  suppressConsole?: boolean;
}

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: "@ifds/hydration-lens-nuxt",
    configKey: "hydrationLens",
  },
  defaults: {
    suppressConsole: false,
  },
  setup(options, nuxt) {
    if (!nuxt.options.dev) return; // hard no-op in production builds

    const resolver = createResolver(import.meta.url);
    addPlugin(resolver.resolve("./runtime/plugin.client"));
  },
});

export default module;
