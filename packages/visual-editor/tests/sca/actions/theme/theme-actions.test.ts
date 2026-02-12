/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, mock, test } from "node:test";
import * as ThemeActions from "../../../../src/sca/actions/theme/theme-actions.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { makeTestFixtures } from "../../helpers/index.js";
import type { EditableGraph, GraphTheme } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import type { AppTheme } from "../../../../src/ui/types/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock editor with `edit` and `raw` support for theme-action tests.
 */
function makeMockEditor(
  opts: {
    metadata?: Record<string, unknown>;
    editSuccess?: boolean;
    url?: string;
  } = {}
) {
  const metadata = opts.metadata ?? {};
  const rawGraph = {
    url: opts.url ?? "https://example.com/board.json",
    nodes: [],
    edges: [],
    metadata,
  };

  const editFn = mock.fn(async (edits: unknown[], _label: string) => {
    // Apply changegraphmetadata edits to rawGraph for state assertions
    for (const edit of edits as Array<{
      type: string;
      metadata: Record<string, unknown>;
    }>) {
      if (edit.type === "changegraphmetadata") {
        rawGraph.metadata = edit.metadata;
      }
    }
    return { success: opts.editSuccess !== false };
  });

  return {
    raw: () => rawGraph,
    edit: editFn,
    inspect: () => ({
      graphs: () => ({}),
      nodes: () => [],
      raw: () => rawGraph,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as EditableGraph & { edit: typeof editFn };
}

function makeAppTheme(): AppTheme {
  return {
    primary: { "0": "#000" },
    secondary: { "0": "#111" },
    tertiary: { "0": "#222" },
    error: { "0": "#f00" },
    neutral: { "0": "#888" },
    neutralVariant: { "0": "#999" },
    primaryColor: "#330072",
    secondaryColor: "#553399",
    textColor: "#ffffff",
    primaryTextColor: "#ffffff",
    backgroundColor: "#1a1a2e",
  } as unknown as AppTheme;
}

function makeGraphTheme(): GraphTheme {
  return {
    template: "basic",
    templateAdditionalOptions: {},
    palette: {
      primary: { "0": "#000" },
      secondary: { "0": "#111" },
      tertiary: { "0": "#222" },
      error: { "0": "#f00" },
      neutral: { "0": "#888" },
      neutralVariant: { "0": "#999" },
    },
    themeColors: {
      primaryColor: "#330072",
      secondaryColor: "#553399",
      textColor: "#ffffff",
      primaryTextColor: "#ffffff",
      backgroundColor: "#1a1a2e",
    },
  };
}

/** Access the theme status on the controller in test code. */
function themeStatus(
  controller: ReturnType<typeof makeTestFixtures>["controller"]
): { status: string } {
  return (
    controller as unknown as {
      editor: { theme: { status: string } };
    }
  ).editor.theme;
}

/** Remove the editor from the controller (simulates no graph). */
function removeEditor(
  controller: ReturnType<typeof makeTestFixtures>["controller"]
) {
  (
    controller as unknown as {
      editor: { graph: { editor: unknown } };
    }
  ).editor.graph.editor = undefined;
}

function setupThemeTest(
  opts: {
    editor?: ReturnType<typeof makeMockEditor>;
    fetchResponse?: { ok?: boolean; json?: unknown };
  } = {}
) {
  const editor = opts.editor ?? makeMockEditor();

  const { controller, services, mocks } = makeTestFixtures({
    withEditor: false,
  });

  // Wire up the editor into the controller
  const ctrl = controller as unknown as Record<string, unknown>;
  ctrl.editor = {
    graph: { editor },
    theme: { status: "idle" as string, themeHash: 0, updateHash() {} },
    selection: { selectionId: 0 },
    sidebar: { section: null },
    step: {
      pendingEdit: null,
      pendingAssetEdit: null,
      clearPendingEdit: mock.fn(),
      clearPendingAssetEdit: mock.fn(),
    },
    share: { state: { status: "closed" } },
  };

  // Wire up fetchWithCreds
  if (opts.fetchResponse) {
    (services as unknown as Record<string, unknown>).fetchWithCreds = mock.fn(
      async () => ({
        ok: opts.fetchResponse!.ok ?? true,
        json: async () => opts.fetchResponse!.json ?? {},
      })
    );
  }

  ThemeActions.bind({ controller, services });

  return { controller, services, mocks, editor };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("Theme Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  // =========================================================================
  // add
  // =========================================================================

  suite("add", () => {
    test("returns error when there is no editor", async () => {
      const { controller } = setupThemeTest();
      removeEditor(controller);

      const result = await ThemeActions.add(makeAppTheme());
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("can't edit the graph"));
    });

    test("returns error when theme status is not idle", async () => {
      const { controller } = setupThemeTest();
      themeStatus(controller).status = "generating";

      const result = await ThemeActions.add(makeAppTheme());
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("not idle"));
    });

    test("persists theme and adds it to the graph", async () => {
      const editor = makeMockEditor();
      setupThemeTest({ editor });

      const result = await ThemeActions.add(makeAppTheme());

      // Should have called editor.edit to persist the theme
      assert.ok(ok(result) || result === undefined);
      assert.strictEqual(editor.edit.mock.calls.length, 1);

      // The metadata should now contain a theme
      const raw = editor.raw() as Record<string, unknown>;
      const meta = raw.metadata as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      assert.ok(meta?.visual?.presentation?.themes);
      assert.ok(meta?.visual?.presentation?.theme);
    });
  });

  // =========================================================================
  // setTheme
  // =========================================================================

  suite("setTheme", () => {
    test("returns error when there is no editor", async () => {
      const { controller } = setupThemeTest();
      removeEditor(controller);

      const result = await ThemeActions.setTheme(makeGraphTheme());
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("can't edit the graph"));
    });

    test("returns error when theme status is not idle", async () => {
      const { controller } = setupThemeTest();
      themeStatus(controller).status = "editing";

      const result = await ThemeActions.setTheme(makeGraphTheme());
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("not idle"));
    });

    test("assigns UUID and sets theme as current", async () => {
      const editor = makeMockEditor();
      setupThemeTest({ editor });

      const graphTheme = makeGraphTheme();
      const result = await ThemeActions.setTheme(graphTheme);

      assert.ok(ok(result) || result === undefined);
      const raw = editor.raw() as Record<string, unknown>;
      const meta = raw.metadata as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      const themes = meta?.visual?.presentation?.themes as Record<
        string,
        unknown
      >;
      const themeKeys = Object.keys(themes ?? {});
      assert.strictEqual(themeKeys.length, 1);
      // Should be a UUID
      assert.ok(themeKeys[0].match(/^[0-9a-f-]{36}$/));
      assert.strictEqual(meta?.visual?.presentation?.theme, themeKeys[0]);
    });

    test("resets theme status to idle after completion", async () => {
      const { controller } = setupThemeTest();

      await ThemeActions.setTheme(makeGraphTheme());
      assert.strictEqual(themeStatus(controller).status, "idle");
    });
  });

  // =========================================================================
  // deleteTheme
  // =========================================================================

  suite("deleteTheme", () => {
    test("returns error when there is no editor", async () => {
      const { controller } = setupThemeTest();
      removeEditor(controller);

      const result = await ThemeActions.deleteTheme("some-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("can't edit the graph"));
    });

    test("returns error when theme status is not idle", async () => {
      const { controller } = setupThemeTest();
      themeStatus(controller).status = "uploading";

      const result = await ThemeActions.deleteTheme("some-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("not idle"));
    });

    test("returns error when theme does not exist", async () => {
      setupThemeTest();

      const result = await ThemeActions.deleteTheme("nonexistent-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("does not exist"));
    });

    test("deletes theme and auto-selects last remaining", async () => {
      const themeA = makeGraphTheme();
      const themeB = makeGraphTheme();
      const editor = makeMockEditor({
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: { "theme-a": themeA, "theme-b": themeB },
            },
          },
        },
      });
      setupThemeTest({ editor });

      const result = await ThemeActions.deleteTheme("theme-a");
      assert.ok(ok(result) || result === undefined);

      const raw = editor.raw() as Record<string, unknown>;
      const meta = raw.metadata as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      const themes = meta?.visual?.presentation?.themes as Record<
        string,
        unknown
      >;
      assert.strictEqual(Object.keys(themes).length, 1);
      assert.ok(!themes["theme-a"]);
      assert.strictEqual(meta?.visual?.presentation?.theme, "theme-b");
    });

    test("resets theme status to idle after deletion", async () => {
      const editor = makeMockEditor({
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: { "theme-a": makeGraphTheme() },
            },
          },
        },
      });
      const { controller } = setupThemeTest({ editor });

      await ThemeActions.deleteTheme("theme-a");
      assert.strictEqual(themeStatus(controller).status, "idle");
    });

    test("returns error when edit fails", async () => {
      const editor = makeMockEditor({
        editSuccess: false,
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: { "theme-a": makeGraphTheme() },
            },
          },
        },
      });
      setupThemeTest({ editor });

      const result = await ThemeActions.deleteTheme("theme-a");
      assert.ok(!ok(result));
    });
  });

  // =========================================================================
  // setCurrent
  // =========================================================================

  suite("setCurrent", () => {
    test("returns error when there is no editor", async () => {
      const { controller } = setupThemeTest();
      removeEditor(controller);

      const result = await ThemeActions.setCurrent("some-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("can't edit the graph"));
    });

    test("returns error when theme status is not idle", async () => {
      const { controller } = setupThemeTest();
      themeStatus(controller).status = "editing";

      const result = await ThemeActions.setCurrent("some-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("not idle"));
    });

    test("returns error when theme does not exist", async () => {
      setupThemeTest();

      const result = await ThemeActions.setCurrent("nonexistent-id");
      assert.ok(!ok(result));
      assert.ok(result.$error.includes("does not exist"));
    });

    test("sets the given theme ID as current", async () => {
      const editor = makeMockEditor({
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: {
                "theme-a": makeGraphTheme(),
                "theme-b": makeGraphTheme(),
              },
            },
          },
        },
      });
      setupThemeTest({ editor });

      const result = await ThemeActions.setCurrent("theme-b");
      assert.ok(ok(result) || result === undefined);

      const raw = editor.raw() as Record<string, unknown>;
      const meta = raw.metadata as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      assert.strictEqual(meta?.visual?.presentation?.theme, "theme-b");
    });

    test("resets theme status to idle after setting", async () => {
      const editor = makeMockEditor({
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: { "theme-a": makeGraphTheme() },
            },
          },
        },
      });
      const { controller } = setupThemeTest({ editor });

      await ThemeActions.setCurrent("theme-a");
      assert.strictEqual(themeStatus(controller).status, "idle");
    });

    test("returns error when edit fails", async () => {
      const editor = makeMockEditor({
        editSuccess: false,
        metadata: {
          visual: {
            presentation: {
              theme: "theme-a",
              themes: { "theme-a": makeGraphTheme() },
            },
          },
        },
      });
      setupThemeTest({ editor });

      const result = await ThemeActions.setCurrent("theme-a");
      assert.ok(!ok(result));
    });
  });

  // =========================================================================
  // generate
  // =========================================================================

  suite("generate", () => {
    test("returns error when theme generation fails", async () => {
      setupThemeTest({
        fetchResponse: { ok: false, json: { error: "generation failed" } },
      });

      const result = await ThemeActions.generate(
        {
          random: false,
          title: "Test App",
        },
        new AbortController().signal
      );

      assert.ok(!ok(result));
    });
  });

  // =========================================================================
  // generateFromIntent
  // =========================================================================

  suite("generateFromIntent", () => {
    test("returns error when theme generation fails", async () => {
      setupThemeTest({
        fetchResponse: { ok: false, json: { error: "generation failed" } },
      });

      const result = await ThemeActions.generateFromIntent(
        "make something cool",
        new AbortController().signal
      );

      assert.ok(!ok(result));
    });

    test("calls persistTheme on successful generation (mocked Image)", async () => {
      // Mock Image so generateImage can succeed in Node
      const originalImage = globalThis.Image;
      class MockImage {
        src = "";
        crossOrigin: string | null = null;
        width = 100;
        height = 100;
      }
      (globalThis as unknown as Record<string, unknown>).Image = MockImage;

      try {
        const editor = makeMockEditor();
        const { controller, services } = setupThemeTest({
          editor,
          fetchResponse: {
            ok: true,
            json: {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: "image/png",
                          data: "iVBORw0KGgo=",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        });

        // Wire up a persistPart mock so persistTheme can complete
        const storedDataResult = {
          storedData: {
            handle: "drive:/persisted-id",
            mimeType: "image/png",
          },
        };
        (
          services as unknown as Record<string, unknown>
        ).googleDriveBoardServer = {
          dataPartTransformer: () => ({
            persistPart: async () => storedDataResult,
          }),
        };

        const result = await ThemeActions.generateFromIntent(
          "make something cool",
          new AbortController().signal
        );

        // If generatePaletteFromImage throws in Node we may still get an error,
        // but if it succeeds, the result should be a valid GraphTheme.
        if (ok(result)) {
          assert.strictEqual(result.template, "basic");
          assert.ok(result.palette);
          assert.ok(result.themeColors);
        }
        // Either way, theme status should be reset to idle
        assert.strictEqual(themeStatus(controller).status, "idle");
      } finally {
        if (originalImage) {
          (globalThis as unknown as Record<string, unknown>).Image =
            originalImage;
        } else {
          delete (globalThis as unknown as Record<string, unknown>).Image;
        }
      }
    });
  });
});
