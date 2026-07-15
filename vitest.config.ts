import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    environmentMatchGlobs: [
      ["**/locator.test.ts", "jsdom"],
      ["**/react-adapter.test.ts", "jsdom"],
    ],
  },
});
