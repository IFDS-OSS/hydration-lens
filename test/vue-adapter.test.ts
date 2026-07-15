import { describe, it, expect, vi } from "vitest";
import { parseVueWarning, vueAdapter } from "../packages/vue/src/adapter";
import { createIssueBus } from "../packages/core/src/bus";

// Captured verbatim (string args only; the live DOM node arg is reproduced separately
// below) from a real Vue 3.5.39 / Nuxt 3.21 dev server reproducing a hydration text
// mismatch (demo/nuxt-demo). Vue's warn() spreads the message, the live node, and the
// component trace across many positional console.warn args — it does NOT hand a single
// pre-interpolated string the way the original design assumed.
const REAL_VUE_35_HYDRATION_ARGS: unknown[] = [
  "[Vue warn]: Hydration text content mismatch on",
  "__LIVE_NODE__",
  "\n  - rendered on server: unga3r5zrxb\n  - expected on client: 3i1bxp013iu",
  "\n",
  " at <Index",
  "onVnodeUnmounted=fn<onVnodeUnmounted>",
  "ref=Ref<",
  undefined,
  ">",
  ">",
  "\n",
  " at <RouteProvider",
  'key="/"',
  "vnode=",
  {},
  "route=",
  {},
  " ...",
  ">",
  "\n",
  " at <NuxtRoot>",
];

describe("parseVueWarning", () => {
  it("parses the real Vue 3.5 multi-arg hydration text mismatch shape", () => {
    const result = parseVueWarning(REAL_VUE_35_HYDRATION_ARGS.map((a) => (a === "__LIVE_NODE__" ? "[node HTMLParagraphElement]" : a)));
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("text");
    expect(result?.expected).toBe("unga3r5zrxb");
    expect(result?.actual).toBe("3i1bxp013iu");
    expect(result?.componentTrail.map((c) => c.name)).toEqual(["Index", "RouteProvider", "NuxtRoot"]);
  });

  it("parses a hydration text mismatch (older documented wording, kept as a fallback)", () => {
    const message = [
      '[Vue warn]: Hydration text mismatch:',
      '- Client: "client text"',
      '- Server: "server text"',
      '',
      '  at <App>',
      '  at <RouterView>',
    ].join("\n");
    const result = parseVueWarning([message]);
    expect(result?.kind).toBe("text");
    expect(result?.actual).toBe("client text");
    expect(result?.expected).toBe("server text");
    expect(result?.componentTrail.map((c) => c.name)).toEqual(["App", "RouterView"]);
  });

  it("parses a hydration node mismatch", () => {
    const message = [
      "[Vue warn]: Hydration node mismatch:",
      "- Client vnode: span",
      "- Server rendered DOM: div",
      "",
      "  at <MyComponent>",
    ].join("\n");
    const result = parseVueWarning([message]);
    expect(result?.kind).toBe("node");
  });

  it("parses a hydration children mismatch", () => {
    const result = parseVueWarning(["[Vue warn]: Hydration children mismatch in <div>: server rendered element contains fewer child nodes than client vdom."]);
    expect(result?.kind).toBe("children");
  });

  it("captures a live DOM node passed as an extra argument for a free 'exact' locate", () => {
    class FakeNode {}
    vi.stubGlobal("Node", FakeNode);
    const el = new FakeNode();

    const result = parseVueWarning([
      "[Vue warn]: Hydration node mismatch:\n- Client vnode: span\n- Server rendered DOM: div",
      el,
    ]);
    expect(result?.liveNode).toBe(el);

    vi.unstubAllGlobals();
  });

  it("does not double-count the follow-up 'completed but contains mismatches' message", () => {
    const result = parseVueWarning(["[Vue warn]: Hydration completed but contains mismatches."]);
    expect(result).toBeNull();
  });

  it("falls back to 'unknown' for an unrecognized but hydration-adjacent message", () => {
    const result = parseVueWarning(["[Vue warn]: Some future hydration warning wording we don't recognize yet."]);
    expect(result?.kind).toBe("unknown");
  });

  it("returns null for unrelated console.warn calls", () => {
    expect(parseVueWarning(["[Vue warn]: Unhandled error during execution of setup function"])).toBeNull();
    expect(parseVueWarning(["A totally unrelated warning"])).toBeNull();
  });

  it("returns null when there is no string message argument", () => {
    expect(parseVueWarning([{ some: "object" }])).toBeNull();
  });
});

describe("vueAdapter.install", () => {
  it("always forwards to the original console.warn by default", () => {
    const bus = createIssueBus();
    const calls: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => calls.push(args);

    const teardown = vueAdapter.install(bus);
    console.warn("[Vue warn]: Hydration children mismatch in <div>.");
    teardown();

    console.warn = original;
    expect(calls).toHaveLength(1);
  });

  it("suppresses only recognized hydration warnings when suppressConsole is true", () => {
    const bus = createIssueBus();
    const calls: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => calls.push(args);

    const teardown = vueAdapter.install(bus, { suppressConsole: true });
    console.warn("[Vue warn]: Hydration children mismatch in <div>.");
    console.warn("Some unrelated warning");
    teardown();

    console.warn = original;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("Some unrelated warning");
  });

  it("does not emit an issue for the 'completed but contains mismatches' follow-up", () => {
    const bus = createIssueBus();
    const issues: unknown[] = [];
    bus.subscribe((issue) => issues.push(issue));
    const original = console.warn;
    console.warn = () => {};

    const teardown = vueAdapter.install(bus);
    console.warn("[Vue warn]: Hydration text mismatch:\n- Client: \"a\"\n- Server: \"b\"");
    console.warn("[Vue warn]: Hydration completed but contains mismatches.");
    teardown();

    console.warn = original;
    expect(issues).toHaveLength(1);
  });
});
