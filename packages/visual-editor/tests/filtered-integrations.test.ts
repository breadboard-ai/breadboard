import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { FilteredIntegrationsImpl } from "../src/ui/state/filtered-integrations.js";
import { IntegrationState, Tool } from "../src/ui/state/types.js";
import { SignalWatcher } from "./signal-watcher.js";
import { Signal } from "signal-polyfill";

describe("FilteredIntegrationsImpl", () => {
  it("initializes with empty integrations", () => {
    const integrations = new Map<string, IntegrationState>();
    const filtered = new FilteredIntegrationsImpl(integrations);
    strictEqual(filtered.results.size, 0);
  });

  it("returns all integrations when filter is empty", () => {
    const integrations = new Map<string, IntegrationState>([
      [
        "url1",
        {
          title: "Integration 1",
          url: "url1",
          status: "complete",
          tools: new Map(),
          message: null,
        },
      ],
    ]);
    const filtered = new FilteredIntegrationsImpl(integrations);
    strictEqual(filtered.results.size, 1);
    strictEqual(filtered.results.get("url1")?.title, "Integration 1");
  });

  it("filters integrations by tool title", () => {
    const tools1 = new Map<string, Tool>([
      ["tool1", { url: "tool1", title: "Awesome Tool" }],
    ]);
    const tools2 = new Map<string, Tool>([
      ["tool2", { url: "tool2", title: "Boring Tool" }],
    ]);

    const integrations = new Map<string, IntegrationState>([
      [
        "url1",
        {
          title: "Integration 1",
          url: "url1",
          status: "complete",
          tools: tools1,
          message: null,
        },
      ],
      [
        "url2",
        {
          title: "Integration 2",
          url: "url2",
          status: "complete",
          tools: tools2,
          message: null,
        },
      ],
    ]);

    const filtered = new FilteredIntegrationsImpl(integrations);

    filtered.filter = "Awesome";
    strictEqual(filtered.results.size, 1);
    strictEqual(filtered.results.get("url1")?.title, "Integration 1");

    filtered.filter = "Boring";
    strictEqual(filtered.results.size, 1);
    strictEqual(filtered.results.get("url2")?.title, "Integration 2");

    filtered.filter = "Tool";
    strictEqual(filtered.results.size, 2);
  });

  it("ignores integrations that are not complete", () => {
    const tools1 = new Map<string, Tool>([
      ["tool1", { url: "tool1", title: "Awesome Tool" }],
    ]);
    const integrations = new Map<string, IntegrationState>([
      [
        "url1",
        {
          title: "Integration 1",
          url: "url1",
          status: "loading",
          tools: tools1,
          message: null,
        },
      ],
    ]);

    const filtered = new FilteredIntegrationsImpl(integrations);
    filtered.filter = "Awesome";
    strictEqual(filtered.results.size, 0);
  });

  it("case insensitive filtering", () => {
    const tools1 = new Map<string, Tool>([
      ["tool1", { url: "tool1", title: "Awesome Tool" }],
    ]);
    const integrations = new Map<string, IntegrationState>([
      [
        "url1",
        {
          title: "Integration 1",
          url: "url1",
          status: "complete",
          tools: tools1,
          message: null,
        },
      ],
    ]);

    const filtered = new FilteredIntegrationsImpl(integrations);
    filtered.filter = "awesome";
    strictEqual(filtered.results.size, 1);
  });

  it("updates results when filter changes", () => {
    const tools1 = new Map<string, Tool>([
      ["tool1", { url: "tool1", title: "Awesome Tool" }],
    ]);
    const integrations = new Map<string, IntegrationState>([
      [
        "url1",
        {
          title: "Integration 1",
          url: "url1",
          status: "complete",
          tools: tools1,
          message: null,
        },
      ],
    ]);

    const filtered = new FilteredIntegrationsImpl(integrations);
    const computed = new Signal.Computed(() => filtered.results);
    const watcher = new SignalWatcher(computed);
    watcher.watch();

    strictEqual(filtered.results.size, 1);
    strictEqual(watcher.count, 0);

    filtered.filter = "Awesome";
    // Force re-evaluation and check
    strictEqual(computed.get().size, 1);
    // Watcher should have fired
    strictEqual(watcher.count, 1);

    watcher.watch();

    filtered.filter = "Boring";
    // Force re-evaluation and check
    strictEqual(computed.get().size, 0);
    // Watcher should have fired again
    strictEqual(watcher.count, 2);
  });
});
