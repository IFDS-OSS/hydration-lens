import { describe, it, expect, beforeEach } from "vitest";
import { locate, describeElement } from "../packages/core/src/locator";
import type { HydrationIssue } from "../packages/core/src/types";

function makeIssue(overrides: Partial<HydrationIssue>): HydrationIssue {
  return {
    id: "1",
    timestamp: 0,
    framework: "react",
    kind: "text",
    rawMessage: "",
    expected: null,
    actual: null,
    componentTrail: [],
    targetSelectorGuess: null,
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("locate", () => {
  it("finds a unique text match exactly", () => {
    document.body.innerHTML = `<div><p>hello</p><p>world</p></div>`;
    const issue = makeIssue({ kind: "text", actual: "world" });
    const result = locate(issue);
    expect(result.confidence).toBe("exact");
    expect(result.element?.textContent).toBe("world");
  });

  it("returns none when text is not found", () => {
    document.body.innerHTML = `<div><p>hello</p></div>`;
    const issue = makeIssue({ kind: "text", actual: "missing" });
    const result = locate(issue);
    expect(result.confidence).toBe("none");
    expect(result.element).toBeNull();
  });

  it("narrows duplicate text matches using the component trail", () => {
    document.body.innerHTML = `
      <div data-component="Header"><span>duplicate</span></div>
      <div data-component="Footer"><span>duplicate</span></div>
    `;
    const issue = makeIssue({
      kind: "text",
      actual: "duplicate",
      componentTrail: [{ name: "Footer", raw: "at Footer" }],
    });
    const result = locate(issue);
    expect(result.confidence).toBe("heuristic");
    expect(result.element?.closest("[data-component]")?.getAttribute("data-component")).toBe("Footer");
  });

  it("gives up (none) when duplicate text can't be narrowed", () => {
    document.body.innerHTML = `<div><span>duplicate</span></div><div><span>duplicate</span></div>`;
    const issue = makeIssue({ kind: "text", actual: "duplicate" });
    const result = locate(issue);
    expect(result.confidence).toBe("none");
    expect(result.element).toBeNull();
  });

  it("finds a unique element by tag name for node mismatches", () => {
    document.body.innerHTML = `<div><span>a</span><em>b</em></div>`;
    const issue = makeIssue({ kind: "node", actual: "em" });
    const result = locate(issue);
    expect(result.confidence).toBe("exact");
    expect(result.element?.tagName.toLowerCase()).toBe("em");
  });

  it("uses a live node reference when present, bypassing tree search", () => {
    document.body.innerHTML = `<div id="target">x</div>`;
    const liveNode = document.getElementById("target")!;
    const issue = makeIssue({ kind: "unknown", liveNode });
    const result = locate(issue);
    expect(result.confidence).toBe("exact");
    expect(result.element).toBe(liveNode);
  });

  it("returns none for children/unknown kinds without a live node", () => {
    const issue = makeIssue({ kind: "children" });
    const result = locate(issue);
    expect(result.confidence).toBe("none");
  });
});

describe("describeElement", () => {
  it("prefers an id when present", () => {
    document.body.innerHTML = `<div id="foo"></div>`;
    expect(describeElement(document.getElementById("foo")!)).toBe("#foo");
  });

  it("falls back to tag name when unique among siblings", () => {
    document.body.innerHTML = `<div><span></span><em></em></div>`;
    const em = document.body.querySelector("em")!;
    expect(describeElement(em)).toBe("em");
  });

  it("uses nth-of-type when siblings share a tag", () => {
    document.body.innerHTML = `<div><span></span><span></span></div>`;
    const spans = document.body.querySelectorAll("span");
    expect(describeElement(spans[1])).toBe("span:nth-of-type(2)");
  });
});
