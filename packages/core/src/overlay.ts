import type { HydrationIssue, IssueBus } from "./types.js";
import { locate, describeElement } from "./locator.js";

const ROOT_ID = "hydration-lens-root";
const HIGHLIGHT_MS = 2000;

const STYLES = `
  :host { all: initial; }
  .badge {
    position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
    background: #dc2626; color: #fff; font: 600 13px/1 system-ui, sans-serif;
    padding: 10px 14px; border-radius: 999px; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3); user-select: none;
  }
  .badge:hover { background: #b91c1c; }
  .panel {
    position: fixed; bottom: 64px; right: 16px; z-index: 2147483647;
    width: 380px; max-height: 60vh; overflow-y: auto;
    background: #1f2937; color: #f3f4f6; font: 13px/1.4 system-ui, sans-serif;
    border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    display: none;
  }
  .panel.open { display: block; }
  .panel-header {
    padding: 10px 14px; font-weight: 700; border-bottom: 1px solid #374151;
    display: flex; justify-content: space-between; align-items: center;
  }
  .issue { padding: 10px 14px; border-bottom: 1px solid #374151; }
  .issue:last-child { border-bottom: none; }
  .issue-top { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
  .fw-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    padding: 2px 6px; border-radius: 4px;
  }
  .fw-react { background: #1e3a8a; color: #93c5fd; }
  .fw-vue { background: #14532d; color: #86efac; }
  .kind { color: #9ca3af; font-size: 11px; }
  .message { margin: 4px 0; word-break: break-word; }
  .locate-btn {
    background: #374151; color: #f3f4f6; border: none; border-radius: 6px;
    padding: 4px 10px; font-size: 12px; cursor: pointer; margin-top: 4px;
  }
  .locate-btn:hover { background: #4b5563; }
  .locate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export function mountOverlay(bus: IssueBus): () => void {
  if (typeof document === "undefined") return () => {};
  if (document.getElementById(ROOT_ID)) return () => {};

  const issues: HydrationIssue[] = [];
  let panelOpen = false;
  let host: HTMLDivElement | undefined;
  let badge: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;

  // React/Vue can discard and regenerate a whole DOM subtree client-side right after
  // detecting a hydration mismatch — if that subtree is (or contains) document.body,
  // it takes our overlay host down with it. ensureMounted() re-creates the host on
  // every render() call whenever it's missing or has been detached, so the overlay
  // survives that regeneration instead of silently vanishing after the first one.
  function ensureMounted() {
    if (host && document.body.contains(host)) return;

    host = document.createElement("div");
    host.id = ROOT_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;
    shadow.appendChild(style);

    badge = document.createElement("div");
    badge.className = "badge";
    shadow.appendChild(badge);

    panel = document.createElement("div");
    panel.className = "panel";
    shadow.appendChild(panel);

    badge.addEventListener("click", () => {
      panelOpen = !panelOpen;
      render();
    });

    panel.addEventListener("click", (event) => {
      const target = event.target as HTMLButtonElement;
      if (target.dataset.action !== "locate") return;
      const issueId = target.dataset.issueId;
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;

      const result = locate(issue);
      if (result.confidence === "none" || !result.element) {
        target.textContent = "Not found";
        target.disabled = true;
        setTimeout(() => {
          target.textContent = "Locate";
          target.disabled = false;
        }, HIGHLIGHT_MS);
        return;
      }

      issue.targetSelectorGuess = describeElement(result.element);
      result.element.scrollIntoView({ behavior: "smooth", block: "center" });
      const el = result.element as HTMLElement;
      const prevOutline = el.style.outline;
      el.style.outline = "3px solid #dc2626";
      setTimeout(() => {
        el.style.outline = prevOutline;
      }, HIGHLIGHT_MS);
    });
  }

  function render() {
    ensureMounted();
    if (!badge || !panel) return;

    badge.textContent = `Hydration issues: ${issues.length}`;
    badge.style.display = issues.length > 0 ? "block" : "none";
    panel.classList.toggle("open", panelOpen);

    panel.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = "Hydration Lens";
    panel.appendChild(header);

    for (const issue of issues) {
      const row = document.createElement("div");
      row.className = "issue";
      row.dataset.issueId = issue.id;

      const top = document.createElement("div");
      top.className = "issue-top";
      const fwBadge = document.createElement("span");
      fwBadge.className = `fw-badge fw-${issue.framework}`;
      fwBadge.textContent = issue.framework;
      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = issue.kind;
      top.append(fwBadge, kind);
      row.appendChild(top);

      const message = document.createElement("div");
      message.className = "message";
      message.textContent = issue.expected && issue.actual
        ? `Server: "${issue.expected}" → Client: "${issue.actual}"`
        : issue.rawMessage;
      row.appendChild(message);

      const locateBtn = document.createElement("button");
      locateBtn.className = "locate-btn";
      locateBtn.textContent = "Locate";
      locateBtn.dataset.action = "locate";
      locateBtn.dataset.issueId = issue.id;
      row.appendChild(locateBtn);

      panel.appendChild(row);
    }
  }

  const unsubscribe = bus.subscribe((issue) => {
    issues.push(issue);
    render();
  });

  return () => {
    unsubscribe();
    host?.remove();
  };
}
