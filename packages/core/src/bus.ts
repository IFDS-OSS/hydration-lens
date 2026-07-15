import type { IssueBus, IssueListener, HydrationIssue } from "./types.js";

export function createIssueBus(): IssueBus {
  const listeners = new Set<IssueListener>();
  return {
    emit(issue: HydrationIssue) {
      for (const listener of listeners) listener(issue);
    },
    subscribe(listener: IssueListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Shared singleton bus so React and Vue adapters (and the overlay) agree on one issue stream. */
export const defaultBus = createIssueBus();
