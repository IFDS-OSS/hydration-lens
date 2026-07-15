import type { HydrationIssue, LocateResult } from "./types.js";

/**
 * Given an issue, try to find the DOM element it refers to, in order of decreasing certainty:
 * live node reference > exact text match > heuristic narrowing by component trail > give up.
 * Never returns a low-confidence guess as if it were certain — callers should treat
 * `confidence: 'none'` as "don't highlight anything".
 */
export function locate(issue: HydrationIssue): LocateResult {
  if (typeof document === "undefined") return { confidence: "none", element: null };

  if (issue.liveNode) {
    const element = elementFromNode(issue.liveNode);
    if (element) return { confidence: "exact", element };
  }

  switch (issue.kind) {
    case "text":
      return locateText(issue);
    case "node":
      return locateNode(issue);
    default:
      return { confidence: "none", element: null };
  }
}

function elementFromNode(node: Node): Element | null {
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement;
  return null;
}

function locateText(issue: HydrationIssue): LocateResult {
  const needle = issue.actual?.trim();
  if (!needle) return { confidence: "none", element: null };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const matches: Element[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() === needle && node.parentElement) {
      matches.push(node.parentElement);
    }
  }

  if (matches.length === 1) return { confidence: "exact", element: matches[0] ?? null };
  if (matches.length === 0) return { confidence: "none", element: null };

  const narrowed = narrowByComponentTrail(issue, matches);
  if (narrowed.length === 1) return { confidence: "heuristic", element: narrowed[0] ?? null };
  return { confidence: "none", element: null };
}

function locateNode(issue: HydrationIssue): LocateResult {
  const tagName = (issue.actual ?? issue.expected)?.trim().toLowerCase();
  if (!tagName) return { confidence: "none", element: null };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const matches: Element[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as Element;
    if (el.tagName.toLowerCase() === tagName) matches.push(el);
  }

  if (matches.length === 1) return { confidence: "exact", element: matches[0] ?? null };
  if (matches.length === 0) return { confidence: "none", element: null };

  const narrowed = narrowByComponentTrail(issue, matches);
  if (narrowed.length === 1) return { confidence: "heuristic", element: narrowed[0] ?? null };
  return { confidence: "none", element: null };
}

function narrowByComponentTrail(issue: HydrationIssue, candidates: Element[]): Element[] {
  const componentName = issue.componentTrail[0]?.name?.toLowerCase();
  if (!componentName) return candidates;

  return candidates.filter((el) => {
    let ancestor: Element | null = el;
    while (ancestor) {
      const tag = ancestor.tagName.toLowerCase();
      const dataAttrs = Array.from(ancestor.attributes)
        .filter((attr) => attr.name.startsWith("data-"))
        .map((attr) => attr.value.toLowerCase());
      if (tag.includes(componentName) || dataAttrs.some((value) => value.includes(componentName))) {
        return true;
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  });
}

/** Human-readable, display-only descriptor. Not used to re-query the DOM. */
export function describeElement(element: Element): string {
  if (element.id) return `#${element.id}`;
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((el) => el.tagName === element.tagName);
  if (siblings.length <= 1) return tag;
  const index = siblings.indexOf(element) + 1;
  return `${tag}:nth-of-type(${index})`;
}
