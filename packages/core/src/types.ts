export type Framework = "react" | "vue";

export type IssueKind = "text" | "node" | "children" | "unknown";

export type LocateConfidence = "exact" | "heuristic" | "none";

export interface ComponentTrailEntry {
  name: string;
  raw: string;
}

export interface HydrationIssue {
  id: string;
  timestamp: number;
  framework: Framework;
  kind: IssueKind;
  rawMessage: string;
  expected: string | null;
  actual: string | null;
  componentTrail: ComponentTrailEntry[];
  /** Display-only. Filled in by the overlay after a successful locate() call, not at emit time. */
  targetSelectorGuess: string | null;
  /** Live DOM/vnode reference captured at warn-time, when the framework hands one to us directly. */
  liveNode?: Node | null;
}

export type IssueListener = (issue: HydrationIssue) => void;

export interface IssueBus {
  emit(issue: HydrationIssue): void;
  subscribe(listener: IssueListener): () => void;
}

export interface AdapterOptions {
  /** When true, hydration warnings are not forwarded to the original console method. Default: false. */
  suppressConsole?: boolean;
}

export interface Adapter {
  name: Framework;
  install(bus: IssueBus, options?: AdapterOptions): () => void;
}

export interface LocateResult {
  confidence: LocateConfidence;
  element: Element | null;
}
