import type { Adapter, AdapterOptions, ComponentTrailEntry, HydrationIssue, IssueBus, IssueKind } from "@ifds-oss/hydration-lens-core";

/**
 * Vue's warn() does NOT hand console.warn a single pre-interpolated string — a real
 * capture from Vue 3.5 / Nuxt 3 shows a call like:
 *
 *   console.warn(
 *     "[Vue warn]: Hydration text content mismatch on",
 *     pElement,                                    // the live DOM node
 *     "\n  - rendered on server: abc\n  - expected on client: xyz",
 *     "\n", " at <Index", "onVnodeUnmounted=fn<...>", ..., " at <RouteProvider", ...
 *   )
 *
 * i.e. the message, the live node, and the component trace are all separate positional
 * args (mixing strings with the live vnode/DOM node), similar in spirit to how React
 * spreads its console.error args — just split differently. We join every *string* arg
 * (skipping the live node / object args) to reconstruct one message to pattern-match
 * and to extract the component trace from.
 */
const VUE_PREFIX = /^\[Vue warn\]:\s*/;
const TEXT_MISMATCH = /Hydration text (?:content )?mismatch/i;
const NODE_MISMATCH = /Hydration node mismatch/i;
const CHILDREN_MISMATCH = /Hydration children mismatch/i;
const COMPLETED_WITH_MISMATCHES = /Hydration completed but contains mismatches/i;
const HYDRATION_KEYWORD = /hydrat/i;

// Real (Vue 3.5) wording: "- rendered on server: X" / "- expected on client: Y".
const SERVER_CLIENT_CURRENT = /rendered on server:\s*([\s\S]*?)\s*\n\s*-\s*expected on client:\s*([\s\S]*?)(?:\n|$)/i;
// Older/documented wording, kept as a fallback in case another Vue version uses it:
// "- Client: "X" - Server: "Y"".
const SERVER_CLIENT_LEGACY = /Client:\s*"?([\s\S]*?)"?\s*\n?\s*-\s*Server:\s*"?([\s\S]*?)"?(?:\n|$)/i;

const TRAIL_TAG = /at <([A-Za-z0-9_.$]+)/g;

let issueCounter = 0;

function joinStringArgs(rawArgs: unknown[]): string {
  return rawArgs.filter((arg): arg is string => typeof arg === "string").join(" ");
}

function extractExpectedActual(message: string): { expected: string | null; actual: string | null } {
  const current = SERVER_CLIENT_CURRENT.exec(message);
  if (current) return { expected: current[1]?.trim() ?? null, actual: current[2]?.trim() ?? null };

  const legacy = SERVER_CLIENT_LEGACY.exec(message);
  if (legacy) return { actual: legacy[1]?.trim() ?? null, expected: legacy[2]?.trim() ?? null };

  return { expected: null, actual: null };
}

function parseComponentTrail(message: string): ComponentTrailEntry[] {
  const trail: ComponentTrailEntry[] = [];
  for (const match of message.matchAll(TRAIL_TAG)) {
    const name = match[1];
    if (name) trail.push({ name, raw: match[0].trim() });
  }
  return trail;
}

export type ParsedVueIssue = Omit<HydrationIssue, "id" | "timestamp" | "framework">;

/**
 * Returns null both for non-hydration console.warn calls AND for the follow-up
 * "Hydration completed but contains mismatches." message — the latter just confirms
 * a mismatch already reported via one of the three shapes above, so it must not
 * be double-counted as a second issue. (In some Vue versions this follow-up is logged
 * via console.error instead, in which case this adapter — which only patches
 * console.warn — never sees it at all, which is equally safe: no double-count risk.)
 */
export function parseVueWarning(rawArgs: unknown[]): ParsedVueIssue | null {
  if (typeof rawArgs[0] !== "string") return null;

  const message = joinStringArgs(rawArgs).replace(VUE_PREFIX, "");
  if (COMPLETED_WITH_MISMATCHES.test(message)) return null;

  let kind: IssueKind;
  if (TEXT_MISMATCH.test(message)) kind = "text";
  else if (NODE_MISMATCH.test(message)) kind = "node";
  else if (CHILDREN_MISMATCH.test(message)) kind = "children";
  else if (HYDRATION_KEYWORD.test(message)) kind = "unknown";
  else return null;

  const { expected, actual } = extractExpectedActual(message);
  const componentTrail = parseComponentTrail(message);

  // Vue hands the live client vnode / server DOM node as a separate object argument
  // (not string-interpolated) — capture it for a free 'exact' locate, bypassing the
  // TreeWalker heuristic entirely for this issue.
  const liveNode = rawArgs.slice(1).find((arg): arg is Node => typeof Node !== "undefined" && arg instanceof Node) ?? null;

  return { kind, rawMessage: message, expected, actual, componentTrail, targetSelectorGuess: null, liveNode };
}

export const vueAdapter: Adapter = {
  name: "vue",
  install(bus: IssueBus, options?: AdapterOptions) {
    const original = console.warn.bind(console);

    console.warn = (...args: unknown[]) => {
      const parsed = parseVueWarning(args);
      if (parsed) {
        bus.emit({
          id: `vue-${++issueCounter}`,
          timestamp: Date.now(),
          framework: "vue",
          ...parsed,
        });
        if (options?.suppressConsole) return; // swallow only warnings we recognized as hydration issues
      }
      original(...args);
    };

    return () => {
      console.warn = original;
    };
  },
};
