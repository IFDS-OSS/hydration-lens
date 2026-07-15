import { describe, it, expect, afterEach } from "vitest";
import { parseReactWarning, parseReactRuntimeError, reactAdapter } from "../packages/react/src/adapter";
import { createIssueBus } from "../packages/core/src/bus";

// Captured verbatim from a real React 19.0 / Next.js 15.5 dev server reproducing a
// Math.random() hydration mismatch in a Client Component (demo/next-demo). React 19
// reports this as a *thrown* Error (an uncaught exception), not a console.error call —
// hence the separate parseReactRuntimeError() parser and window 'error' listener below.
const REAL_REACT_19_HYDRATION_ERROR = `Hydration failed because the server rendered text didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch \`if (typeof window !== 'undefined')\`.
- Variable input such as \`Date.now()\` or \`Math.random()\` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <RenderFromTemplateContext>
      <ScrollAndFocusHandler segmentPath={[...]}>
        <InnerScrollAndFocusHandler segmentPath={[...]} focusAndScrollRef={{apply:false, ...}}>
          <ErrorBoundary errorComponent={undefined} errorStyles={undefined} errorScripts={undefined}>
            <LoadingBoundary loading={null}>
              <HTTPAccessFallbackBoundary notFound={<SegmentViewNode>} forbidden={undefined} unauthorized={undefined}>
                <HTTPAccessFallbackErrorBoundary pathname="/" notFound={<SegmentViewNode>} forbidden={undefined} ...>
                  <RedirectBoundary>
                    <RedirectErrorBoundary router={{...}}>
                      <InnerLayoutRouter url="/" tree={[...]} cacheNode={{lazyData:null, ...}} segmentPath={[...]}>
                        <SegmentViewNode type="page" pagePath="page.tsx">
                          <SegmentTrieNode>
                          <Home>
                            <main style={{...}}>
                              <h1>
                              <p>
                              <Mismatch>
                                <p id="mismatch">
+                                 l4gojo96i3n
-                                 dyydxuxle66
                        ...
                      ...
          ...
`;

describe("parseReactWarning", () => {
  it("parses a text mismatch warning with positional args", () => {
    const stack = "\n    in p (at page.tsx:10)\n    in Home (at page.tsx:20)";
    const result = parseReactWarning([
      'Text content did not match. Server: "%s" Client: "%s"%s',
      "server-value",
      "client-value",
      stack,
    ]);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("text");
    expect(result?.expected).toBe("server-value");
    expect(result?.actual).toBe("client-value");
    expect(result?.componentTrail).toEqual([
      { name: "p", raw: "in p (at page.tsx:10)" },
      { name: "Home", raw: "in Home (at page.tsx:20)" },
    ]);
  });

  it("parses a tag mismatch warning", () => {
    const result = parseReactWarning([
      "Warning: Expected server HTML to contain a matching <%s> in <%s>.",
      "span",
      "div",
    ]);
    expect(result?.kind).toBe("node");
    expect(result?.actual).toBe("span");
  });

  it("parses the generic hydration-failed message as 'unknown'", () => {
    const result = parseReactWarning([
      "Warning: Hydration failed because the initial UI does not match what was rendered on the server.",
    ]);
    expect(result?.kind).toBe("unknown");
  });

  it("parses Suspense-boundary hydration errors as 'unknown'", () => {
    const result = parseReactWarning([
      "Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>.",
    ]);
    expect(result?.kind).toBe("unknown");
  });

  it("falls back to 'unknown' for an unrecognized but hydration-adjacent message", () => {
    const result = parseReactWarning(["Some future hydration warning wording we don't recognize yet."]);
    expect(result?.kind).toBe("unknown");
  });

  it("returns null for unrelated console.error calls", () => {
    expect(parseReactWarning(["Warning: Failed prop type: something unrelated"])).toBeNull();
    expect(parseReactWarning(["A totally unrelated error"])).toBeNull();
  });

  it("returns null when there is no string format argument", () => {
    expect(parseReactWarning([new Error("boom")])).toBeNull();
  });
});

describe("parseReactRuntimeError", () => {
  it("parses the real React 19 thrown-Error hydration mismatch shape", () => {
    const result = parseReactRuntimeError(new Error(REAL_REACT_19_HYDRATION_ERROR));
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("text");
    expect(result?.actual).toBe("l4gojo96i3n");
    expect(result?.expected).toBe("dyydxuxle66");
    expect(result?.componentTrail.map((c) => c.name)).toContain("Mismatch");
    expect(result?.componentTrail.map((c) => c.name)).toContain("Home");
  });

  it("returns null for a non-hydration thrown error", () => {
    expect(parseReactRuntimeError(new Error("TypeError: cannot read property of undefined"))).toBeNull();
  });
});

describe("reactAdapter.install", () => {
  afterEach(() => {
    // adapter.install always returns a teardown; nothing to clean up if a test doesn't install.
  });

  it("always forwards to the original console.error by default", () => {
    const bus = createIssueBus();
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    const teardown = reactAdapter.install(bus);
    console.error("Warning: Hydration failed because the initial UI does not match what was rendered on the server.");
    teardown();

    console.error = original;
    expect(calls).toHaveLength(1);
  });

  it("suppresses only recognized hydration warnings when suppressConsole is true", () => {
    const bus = createIssueBus();
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    const teardown = reactAdapter.install(bus, { suppressConsole: true });
    console.error("Warning: Hydration failed because the initial UI does not match what was rendered on the server.");
    console.error("Some unrelated error");
    teardown();

    console.error = original;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("Some unrelated error");
  });

  it("emits a HydrationIssue on the bus for recognized warnings", () => {
    const bus = createIssueBus();
    const issues: unknown[] = [];
    bus.subscribe((issue) => issues.push(issue));
    const original = console.error;
    console.error = () => {};

    const teardown = reactAdapter.install(bus);
    console.error('Text content did not match. Server: "%s" Client: "%s"', "a", "b");
    teardown();

    console.error = original;
    expect(issues).toHaveLength(1);
  });

  it("also catches hydration errors reported as an uncaught 'error' event (the React 19 thrown-Error shape)", () => {
    const bus = createIssueBus();
    const issues: unknown[] = [];
    bus.subscribe((issue) => issues.push(issue));

    const teardown = reactAdapter.install(bus);
    window.dispatchEvent(new ErrorEvent("error", { error: new Error(REAL_REACT_19_HYDRATION_ERROR) }));
    teardown();

    expect(issues).toHaveLength(1);
    expect((issues[0] as { kind: string }).kind).toBe("text");
  });

  it("does not react to unrelated uncaught errors", () => {
    const bus = createIssueBus();
    const issues: unknown[] = [];
    bus.subscribe((issue) => issues.push(issue));

    const teardown = reactAdapter.install(bus);
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("some unrelated crash") }));
    teardown();

    expect(issues).toHaveLength(0);
  });

  it("suppresses the default uncaught-error logging only when suppressConsole is true", () => {
    const bus = createIssueBus();
    const teardown = reactAdapter.install(bus, { suppressConsole: true });

    const event = new ErrorEvent("error", { error: new Error(REAL_REACT_19_HYDRATION_ERROR), cancelable: true });
    window.dispatchEvent(event);
    teardown();

    expect(event.defaultPrevented).toBe(true);
  });
});
