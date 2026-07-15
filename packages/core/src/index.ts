export type {
  Framework,
  IssueKind,
  LocateConfidence,
  ComponentTrailEntry,
  HydrationIssue,
  IssueListener,
  IssueBus,
  AdapterOptions,
  Adapter,
  LocateResult,
} from "./types.js";

export { createIssueBus, defaultBus } from "./bus.js";
export { locate, describeElement } from "./locator.js";
export { mountOverlay } from "./overlay.js";
