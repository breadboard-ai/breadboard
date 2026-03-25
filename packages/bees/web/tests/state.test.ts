/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { BeesState } from "../src/data/state.js";
import type { TicketData } from "../src/data/types.js";

function makeTicket(overrides: Partial<TicketData> = {}): TicketData {
  return {
    id: "ticket-1",
    objective: "Do something",
    status: "available",
    ...overrides,
  };
}

describe("BeesState", () => {
  let state: BeesState;

  beforeEach(() => {
    state = new BeesState();
  });

  describe("tickets", () => {
    it("starts with an empty array", () => {
      assert.deepEqual(state.tickets.get(), []);
    });
  });

  describe("draining", () => {
    it("starts as false", () => {
      assert.equal(state.draining.get(), false);
    });

    it("can be toggled", () => {
      state.draining.set(true);
      assert.equal(state.draining.get(), true);
      state.draining.set(false);
      assert.equal(state.draining.get(), false);
    });
  });

  describe("upsertTicket", () => {
    it("adds a new ticket to the front", () => {
      const t = makeTicket({ id: "aaa" });
      state.upsertTicket(t);
      assert.equal(state.tickets.get().length, 1);
      assert.equal(state.tickets.get()[0].id, "aaa");
    });

    it("prepends new tickets", () => {
      state.upsertTicket(makeTicket({ id: "first" }));
      state.upsertTicket(makeTicket({ id: "second" }));
      assert.equal(state.tickets.get()[0].id, "second");
      assert.equal(state.tickets.get()[1].id, "first");
    });

    it("updates an existing ticket in place", () => {
      state.upsertTicket(makeTicket({ id: "aaa", status: "available" }));
      state.upsertTicket(makeTicket({ id: "aaa", status: "completed" }));
      assert.equal(state.tickets.get().length, 1);
      assert.equal(state.tickets.get()[0].status, "completed");
    });

    it("does not affect other tickets on update", () => {
      state.upsertTicket(makeTicket({ id: "a" }));
      state.upsertTicket(makeTicket({ id: "b" }));
      state.upsertTicket(makeTicket({ id: "a", objective: "changed" }));

      assert.equal(state.tickets.get().length, 2);
      const a = state.tickets.get().find((t) => t.id === "a");
      assert.equal(a?.objective, "changed");
    });
  });

  describe("appendEvent", () => {
    it("appends an event to an existing ticket", () => {
      state.upsertTicket(makeTicket({ id: "aaa" }));
      state.appendEvent("aaa", { thought: { text: "thinking..." } });

      const ticket = state.tickets.get()[0];
      assert.equal(ticket.events_log?.length, 1);
      assert.deepEqual(ticket.events_log?.[0], {
        thought: { text: "thinking..." },
      });
    });

    it("preserves existing events", () => {
      state.upsertTicket(
        makeTicket({
          id: "aaa",
          events_log: [{ functionCall: { name: "search" } }],
        })
      );
      state.appendEvent("aaa", { thought: { text: "hmm" } });

      const ticket = state.tickets.get()[0];
      assert.equal(ticket.events_log?.length, 2);
    });

    it("does nothing for unknown ticket id", () => {
      state.upsertTicket(makeTicket({ id: "aaa" }));
      state.appendEvent("nonexistent", { thought: { text: "lost" } });
      assert.equal(state.tickets.get()[0].events_log, undefined);
    });

    it("does not mutate the original ticket object", () => {
      const original = makeTicket({ id: "aaa" });
      state.upsertTicket(original);
      state.appendEvent("aaa", { thought: { text: "new" } });

      // The original should be untouched.
      assert.equal(original.events_log, undefined);
    });
  });
});
