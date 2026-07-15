import type { Adapter, AdapterOptions, ComponentTrailEntry, HydrationIssue, IssueBus, IssueKind } from "hydration-lens-core";

/**
 * React's console.error hydration warnings are called with an un-interpolated format
 * string plus positional args (the browser substitutes %s only for display), so these
 * regexes match against the raw format string, not an already-substituted message.
 *
 * Exact wording has shifted across React 18/19 point releases (e.g. optional "Warning: "
 * prefix, quoted vs unquoted %s). These are intentionally tolerant of that drift; validate
 * against a live repro before adding new shapes.
 */
const TEXT_MISMATCH = /Text content did not match\. Server: "?%s"? Client: "?%s"?/;
const TAG_MISMATCH = /Expected server HTML to contain a matching <%s> in <%s>/;
const HYDRATION_FAILED = /Hydration failed because/i;
const SUSPENSE_HYDRATION = /error occurred during hydration/i;
const HYDRATION_KEYWORD = /hydrat/i;

const STACK_LINE = /^\s*(?:in|at)\s+([A-Za-z0-9_.$]+)/;

/**
 * React 19 reports most hydration mismatches as a genuinely *thrown* Error (surfaced to
 * the browser as an uncaught exception), not a console.error(...) call — so the regexes
 * above never see it at all. The message body is a JSX-tree-shaped diff instead of the
 * old "Server: X Client: Y" sentence, e.g.:
 *
 *   Hydration failed because the server rendered text didn't match the client. ...
 *     <Home>
 *       <Mismatch>
 *         <p id="mismatch">
 *   +       client-value
 *   -       server-value
 *
 * `+` is the client-rendered value, `-` is the server-rendered one (standard diff convention).
 */
const DIFF_LINE = /^([+-])\s+(.*)$/gm;
const TREE_TAG_LINE = /^\s*<([A-Za-z][\w.$]*)/gm;

let issueCounter = 0;

function formatMessage(format: string, values: string[]): string {
  let i = 0;
  return format.replace(/%s/g, () => (i < values.length ? (values[i++] ?? "%s") : "%s"));
}

function parseComponentTrail(stack: string): ComponentTrailEntry[] {
  const trail: ComponentTrailEntry[] = [];
  for (const rawLine of stack.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = STACK_LINE.exec(line);
    if (match?.[1]) trail.push({ name: match[1], raw: line });
  }
  return trail;
}

function findComponentStack(args: string[]): string | null {
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (arg !== undefined && /\n\s*(?:in|at)\s+\S/.test(arg)) return arg;
  }
  return null;
}

export type ParsedReactIssue = Omit<HydrationIssue, "id" | "timestamp" | "framework">;

/** Returns null when the console.error call isn't a hydration warning at all. */
export function parseReactWarning(rawArgs: unknown[]): ParsedReactIssue | null {
  const format = typeof rawArgs[0] === "string" ? rawArgs[0] : "";
  if (!format) return null;

  let kind: IssueKind;
  let expected: string | null = null;
  let actual: string | null = null;
  const stringArgs = rawArgs.map((arg) => (typeof arg === "string" ? arg : String(arg)));
  const values = stringArgs.slice(1);

  if (TEXT_MISMATCH.test(format)) {
    kind = "text";
    expected = values[0] ?? null;
    actual = values[1] ?? null;
  } else if (TAG_MISMATCH.test(format)) {
    kind = "node";
    actual = values[0] ?? null;
  } else if (HYDRATION_FAILED.test(format) || SUSPENSE_HYDRATION.test(format)) {
    kind = "unknown";
  } else if (HYDRATION_KEYWORD.test(format)) {
    kind = "unknown";
  } else {
    return null;
  }

  const stack = findComponentStack(stringArgs);
  const componentTrail = stack ? parseComponentTrail(stack) : [];
  const rawMessage = formatMessage(format, values);

  return { kind, rawMessage, expected, actual, componentTrail, targetSelectorGuess: null };
}

/** Parses the thrown-Error shape described above. Returns null if it isn't hydration-related. */
export function parseReactRuntimeError(error: Error): ParsedReactIssue | null {
  const message = error.message;
  if (!HYDRATION_KEYWORD.test(message)) return null;

  let expected: string | null = null;
  let actual: string | null = null;
  for (const match of message.matchAll(DIFF_LINE)) {
    const [, sign, value] = match;
    if (sign === "+") actual = (value ?? "").trim();
    else if (sign === "-") expected = (value ?? "").trim();
  }

  const kind: IssueKind = /text/i.test(message) ? "text" : "unknown";

  const componentTrail: ComponentTrailEntry[] = [];
  for (const match of message.matchAll(TREE_TAG_LINE)) {
    const name = match[1];
    if (name) componentTrail.push({ name, raw: match[0].trim() });
  }

  return { kind, rawMessage: message, expected, actual, componentTrail, targetSelectorGuess: null };
}

export const reactAdapter: Adapter = {
  name: "react",
  install(bus: IssueBus, options?: AdapterOptions) {
    const original = console.error.bind(console);

    console.error = (...args: unknown[]) => {
      const parsed = parseReactWarning(args);
      if (parsed) {
        bus.emit({
          id: `react-${++issueCounter}`,
          timestamp: Date.now(),
          framework: "react",
          ...parsed,
        });
        if (options?.suppressConsole) return; // swallow only warnings we recognized as hydration issues
      }
      original(...args);
    };

    const errorListener = (event: ErrorEvent) => {
      if (!(event.error instanceof Error)) return;
      const parsed = parseReactRuntimeError(event.error);
      if (!parsed) return;
      bus.emit({
        id: `react-${++issueCounter}`,
        timestamp: Date.now(),
        framework: "react",
        ...parsed,
      });
      if (options?.suppressConsole) event.preventDefault(); // suppress only the default uncaught-error logging
    };
    if (typeof window !== "undefined") window.addEventListener("error", errorListener);

    return () => {
      console.error = original;
      if (typeof window !== "undefined") window.removeEventListener("error", errorListener);
    };
  },
};
