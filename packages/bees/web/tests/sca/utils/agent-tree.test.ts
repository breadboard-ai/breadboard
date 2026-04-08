/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveAgentTree,
  deriveChildAgents,
  derivePerspectives,
} from "../../../src/sca/utils/agent-tree.js";
import type { TicketData } from "../../../src/data/types.js";

function ticket(overrides: Partial<TicketData> & { id: string }): TicketData {
  return {
    objective: "",
    status: "available",
    ...overrides,
  };
}

describe("deriveAgentTree", () => {
  it("returns an empty forest for an empty ticket list", () => {
    const tree = deriveAgentTree([]);
    assert.deepEqual(tree, []);
  });

  it("returns root nodes for tickets without creator_ticket_id", () => {
    const tree = deriveAgentTree([
      ticket({ id: "a", created_at: "2026-01-01" }),
      ticket({ id: "b", created_at: "2026-01-02" }),
    ]);

    assert.equal(tree.length, 2);
    assert.equal(tree[0].ticket.id, "a");
    assert.equal(tree[1].ticket.id, "b");
    assert.deepEqual(tree[0].children, []);
    assert.deepEqual(tree[1].children, []);
  });

  it("nests children under their creator", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root", created_at: "2026-01-01" }),
      ticket({
        id: "child-1",
        creator_ticket_id: "root",
        created_at: "2026-01-02",
      }),
      ticket({
        id: "child-2",
        creator_ticket_id: "root",
        created_at: "2026-01-03",
      }),
    ]);

    assert.equal(tree.length, 1);
    assert.equal(tree[0].ticket.id, "root");
    assert.equal(tree[0].children.length, 2);
    assert.equal(tree[0].children[0].ticket.id, "child-1");
    assert.equal(tree[0].children[1].ticket.id, "child-2");
  });

  it("builds multi-level trees", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root", created_at: "2026-01-01" }),
      ticket({
        id: "child",
        creator_ticket_id: "root",
        created_at: "2026-01-02",
      }),
      ticket({
        id: "grandchild",
        creator_ticket_id: "child",
        created_at: "2026-01-03",
      }),
    ]);

    assert.equal(tree.length, 1);
    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[0].children[0].children.length, 1);
    assert.equal(tree[0].children[0].children[0].ticket.id, "grandchild");
  });

  it("excludes coordination tickets", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root", created_at: "2026-01-01" }),
      ticket({
        id: "coord",
        creator_ticket_id: "root",
        kind: "coordination",
        created_at: "2026-01-02",
      }),
      ticket({
        id: "agent",
        creator_ticket_id: "root",
        created_at: "2026-01-03",
      }),
    ]);

    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[0].children[0].ticket.id, "agent");
  });

  it("excludes digest-tagged tickets", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root", created_at: "2026-01-01" }),
      ticket({
        id: "digest",
        creator_ticket_id: "root",
        tags: ["digest"],
        created_at: "2026-01-02",
      }),
    ]);

    assert.equal(tree[0].children.length, 0);
  });

  it("sorts children by created_at", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root", created_at: "2026-01-01" }),
      ticket({
        id: "late",
        creator_ticket_id: "root",
        created_at: "2026-01-03",
      }),
      ticket({
        id: "early",
        creator_ticket_id: "root",
        created_at: "2026-01-02",
      }),
    ]);

    assert.equal(tree[0].children[0].ticket.id, "early");
    assert.equal(tree[0].children[1].ticket.id, "late");
  });

  it("handles multiple root trees (forest)", () => {
    const tree = deriveAgentTree([
      ticket({ id: "root-a", created_at: "2026-01-01" }),
      ticket({ id: "root-b", created_at: "2026-01-02" }),
      ticket({
        id: "child-a",
        creator_ticket_id: "root-a",
        created_at: "2026-01-03",
      }),
    ]);

    assert.equal(tree.length, 2);
    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[1].children.length, 0);
  });
});

describe("deriveChildAgents", () => {
  it("returns direct children of the given parent", () => {
    const tickets = [
      ticket({ id: "root" }),
      ticket({ id: "child-1", creator_ticket_id: "root" }),
      ticket({ id: "child-2", creator_ticket_id: "root" }),
      ticket({ id: "grandchild", creator_ticket_id: "child-1" }),
    ];

    const children = deriveChildAgents(tickets, "root");
    assert.equal(children.length, 2);
    assert.deepEqual(
      children.map((c) => c.id),
      ["child-1", "child-2"]
    );
  });

  it("excludes coordination and digest tickets", () => {
    const tickets = [
      ticket({ id: "root" }),
      ticket({ id: "coord", creator_ticket_id: "root", kind: "coordination" }),
      ticket({
        id: "digest",
        creator_ticket_id: "root",
        tags: ["digest"],
      }),
      ticket({ id: "agent", creator_ticket_id: "root" }),
    ];

    const children = deriveChildAgents(tickets, "root");
    assert.equal(children.length, 1);
    assert.equal(children[0].id, "agent");
  });
});

describe("derivePerspectives", () => {
  it("detects chat perspective from tags", () => {
    const t = ticket({ id: "t", tags: ["chat"] });
    const p = derivePerspectives(t, [t]);
    assert.equal(p.hasChat, true);
    assert.equal(p.hasBundle, false);
    assert.equal(p.hasSubagents, false);
  });

  it("detects bundle perspective from tags", () => {
    const t = ticket({ id: "t", tags: ["bundle"] });
    const p = derivePerspectives(t, [t]);
    assert.equal(p.hasBundle, true);
  });

  it("detects subagents from children tickets", () => {
    const parent = ticket({ id: "parent" });
    const child = ticket({ id: "child", creator_ticket_id: "parent" });
    const p = derivePerspectives(parent, [parent, child]);
    assert.equal(p.hasSubagents, true);
  });

  it("does not count coordination children as subagents", () => {
    const parent = ticket({ id: "parent" });
    const coord = ticket({
      id: "coord",
      creator_ticket_id: "parent",
      kind: "coordination",
    });
    const p = derivePerspectives(parent, [parent, coord]);
    assert.equal(p.hasSubagents, false);
  });

  it("detects all three perspectives simultaneously", () => {
    const parent = ticket({ id: "parent", tags: ["chat", "bundle"] });
    const child = ticket({ id: "child", creator_ticket_id: "parent" });
    const p = derivePerspectives(parent, [parent, child]);
    assert.equal(p.hasChat, true);
    assert.equal(p.hasBundle, true);
    assert.equal(p.hasSubagents, true);
  });
});
