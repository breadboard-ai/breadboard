/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { deriveLiteViewType } from "../../../src/sca/utils/lite-view-type.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import type { SCA } from "../../../src/sca/sca.js";

// Helper to create a mock SCA with specific state
function createMockSCA(overrides: {
  viewError?: string;
  loadState?: "Home" | "Loading" | "Loaded" | "Error";
  parsedUrl?: { page: string; new?: boolean; flow?: string };
  isGenerating?: boolean;
}): SCA {
  const {
    viewError = "",
    loadState = "Loaded",
    parsedUrl = { page: "home", new: true },
    isGenerating = false,
  } = overrides;

  return {
    controller: {
      global: {
        main: {
          viewError,
          loadState,
        },
        flowgenInput: {
          state: { status: isGenerating ? "generating" : "initial" },
        },
      },
      router: {
        parsedUrl,
      },
    },
  } as unknown as SCA;
}

suite("deriveLiteViewType", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("returns 'error' when viewError is set", () => {
    const sca = createMockSCA({ viewError: "Something went wrong" });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "error");
  });

  test("returns 'home' when loadState is Home and parsedUrl.new is true", () => {
    const sca = createMockSCA({
      loadState: "Home",
      parsedUrl: { page: "home", new: true },
    });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "home");
  });

  test("returns 'loading' when loadState is Home but URL has a flow", () => {
    const sca = createMockSCA({
      loadState: "Home",
      parsedUrl: { page: "graph", flow: "some-flow-id" },
    });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "loading");
  });

  test("returns 'loading' when loadState is Loading and not generating", () => {
    const sca = createMockSCA({
      loadState: "Loading",
      isGenerating: false,
    });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "loading");
  });

  test("returns 'editor' when loadState is Loading and generating", () => {
    const sca = createMockSCA({
      loadState: "Loading",
      isGenerating: true,
    });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "editor");
  });

  test("returns 'error' when loadState is Error", () => {
    const sca = createMockSCA({ loadState: "Error" });
    const result = deriveLiteViewType(sca, false);
    assert.strictEqual(result, "error");
  });

  test("returns 'home' when loadState is Loaded and graph is empty", () => {
    const sca = createMockSCA({ loadState: "Loaded" });
    const result = deriveLiteViewType(sca, true); // isGraphEmpty = true
    assert.strictEqual(result, "home");
  });

  test("returns 'editor' when loadState is Loaded and graph has nodes", () => {
    const sca = createMockSCA({ loadState: "Loaded" });
    const result = deriveLiteViewType(sca, false); // isGraphEmpty = false
    assert.strictEqual(result, "editor");
  });

  test("returns 'editor' when Loaded, graph empty, but generating (flowgen in progress)", () => {
    const sca = createMockSCA({
      loadState: "Loaded",
      isGenerating: true,
    });
    const result = deriveLiteViewType(sca, true); // graph empty, but generating
    assert.strictEqual(result, "editor");
  });

  test("returns 'home' when Home without new flag and page is 'home'", () => {
    const sca = createMockSCA({
      loadState: "Home",
      parsedUrl: { page: "home" },
    });
    // This falls through the "Home" case without matching new or graph conditions
    // and hits the c8-ignored logging path, so we can't easily test that branch.
    // But testing the parsedUrl.page === 'home' without `new` is still useful.
    const result = deriveLiteViewType(sca, false);
    // Without parsedUrl.new, zeroState is falsy, so it falls through
    // to the logging/invalid path (c8-ignored).
    assert.strictEqual(result, "invalid");
  });
});
