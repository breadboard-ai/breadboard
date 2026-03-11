/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Demo flow — a simple state machine for the circle-to-invoke prototype.
 * No XState dependency — just a minimal hand-rolled FSM.
 * We can add XState later if the flow gets complex.
 */
export { DemoFlow, type FlowState };

type FlowState =
  | "idle" // Projection visible, normal interaction
  | "onboarding" // First visit — ghost hint visible
  | "selecting" // Selection mode — gesture active, items glow
  | "focused" // Selection made, contextual input visible
  | "responding" // EA is "working" (simulated)
  | "resolved"; // EA has acted, showing result

type FlowListener = (state: FlowState, data?: unknown) => void;

class DemoFlow {
  private state: FlowState = "onboarding";
  private listeners: FlowListener[] = [];
  private selectedItems: string[] = [];

  constructor() {
    // Don't transition here — listeners aren't registered yet.
    // Call start() after registering onStateChange.
  }

  /** Kick off the flow. Call after registering listeners. */
  start(): void {
    // Start with onboarding — teach the circle gesture.
    this.transition("onboarding");
  }

  getState(): FlowState {
    return this.state;
  }

  getSelected(): string[] {
    return this.selectedItems;
  }

  onStateChange(fn: FlowListener): void {
    this.listeners.push(fn);
  }

  /** Transition to a new state with validation. */
  transition(next: FlowState, data?: unknown): void {
    const prev = this.state;

    // Validate transitions.
    const valid: Record<FlowState, FlowState[]> = {
      onboarding: ["idle", "selecting"],
      idle: ["selecting"],
      selecting: ["focused", "idle"],
      focused: ["responding", "idle"],
      responding: ["resolved"],
      resolved: ["idle"],
    };

    if (prev !== next && !valid[prev]?.includes(next)) {
      console.warn(`Invalid transition: ${prev} → ${next}`);
      return;
    }

    this.state = next;

    if (next === "focused" && data) {
      this.selectedItems = (data as { circled: string[] }).circled;
    }

    if (next === "idle") {
      this.selectedItems = [];
    }

    for (const fn of this.listeners) {
      fn(next, data);
    }
  }

  /** Simulate EA response after a delay. */
  simulateResponse(query: string): void {
    this.transition("responding");

    // Look up hardcoded response based on selection.
    const response = getResponse(this.selectedItems, query);

    setTimeout(
      () => {
        this.transition("resolved", response);
      },
      1200 + Math.random() * 800
    );
  }
}

// ─── Hardcoded EA Responses ───────────────────────────────────

interface EAResponse {
  title: string;
  message: string;
}

function getResponse(selected: string[], query: string): EAResponse {
  const q = query.toLowerCase();

  if (selected.includes("side") && q.includes("dairy")) {
    return {
      title: "Updated: Dairy-Free Risotto",
      message:
        "Swapped parmesan for nutritional yeast and used oat cream. " +
        "Same rich texture, fully dairy-free. Updated the shopping list too.",
    };
  }

  if (
    selected.includes("main") &&
    (q.includes("vegetarian") || q.includes("veg"))
  ) {
    return {
      title: "Alternative: Stuffed Portobello Wellington",
      message:
        "A showstopper vegetarian main — roasted portobello mushrooms wrapped in puff pastry " +
        "with spinach and goat cheese. Same prep timeline, adjusted the schedule.",
    };
  }

  if (selected.includes("appetizer")) {
    return {
      title: "Got it",
      message:
        "I can adjust the starter to match. Want me to try a salad " +
        "version instead, or keep the soup format?",
    };
  }

  if (selected.includes("timeline")) {
    return {
      title: "Timeline Adjusted",
      message:
        "Moved everything 30 minutes earlier to give you buffer time. " +
        "Also added a reminder to chill the wine at 5 PM.",
    };
  }

  if (selected.includes("dessert")) {
    return {
      title: "Updated: Chocolate Fondant",
      message:
        "Swapped the tarte tatin for individual chocolate fondants — " +
        "easier to plate, and they can be prepped 4 hours ahead.",
    };
  }

  // Fallback.
  return {
    title: "On it",
    message:
      `Working on "${query}" for ${selected.join(", ")}. ` +
      "Give me a moment to figure out the best approach.",
  };
}
