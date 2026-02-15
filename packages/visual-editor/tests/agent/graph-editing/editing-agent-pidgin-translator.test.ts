/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { EditingAgentPidginTranslator } from "../../../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import { stubCaps } from "../../useful-stubs.js";
import { deepStrictEqual, strictEqual } from "node:assert";
import { Template } from "../../../src/a2/a2/template.js";
import { ROUTE_TOOL_PATH } from "../../../src/a2/a2/tool-manager.js";
import { llm } from "../../../src/a2/a2/utils.js";

function makeTranslator(): EditingAgentPidginTranslator {
  return new EditingAgentPidginTranslator(stubCaps);
}

describe("EditingAgentPidginTranslator", () => {
  describe("toPidgin", () => {
    it("translates 'in' params to parent handles", () => {
      const translator = makeTranslator();
      const content = llm`Hello ${Template.part({
        type: "in",
        path: "abc-123",
        title: "Input A",
      })} world`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Hello <parent src="node-1" /> world`);
    });

    it("deduplicates same node paths", () => {
      const translator = makeTranslator();
      const content = llm`${Template.part({
        type: "in",
        path: "abc-123",
        title: "Input A",
      })} and ${Template.part({
        type: "in",
        path: "abc-123",
        title: "Input A",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(
        result.text,
        `<parent src="node-1" /> and <parent src="node-1" />`
      );
    });

    it("assigns different handles for different node paths", () => {
      const translator = makeTranslator();
      const content = llm`${Template.part({
        type: "in",
        path: "abc-123",
        title: "Input A",
      })} and ${Template.part({
        type: "in",
        path: "def-456",
        title: "Input B",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(
        result.text,
        `<parent src="node-1" /> and <parent src="node-2" />`
      );
    });

    it("translates asset params to file references", () => {
      const translator = makeTranslator();
      const content = llm`See ${Template.part({
        type: "asset",
        path: "assets/image.png",
        title: "My Image",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `See <file src="assets/image.png" />`);
    });

    it("translates known tools to friendly names", () => {
      const translator = makeTranslator();
      const content = llm`Use ${Template.part({
        type: "tool",
        path: "embed://a2/tools.bgl.json#module:get-weather",
        title: "Get Weather",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Use <tool name="get-weather" />`);
    });

    it("translates unknown tools to numbered handles", () => {
      const translator = makeTranslator();
      const content = llm`Use ${Template.part({
        type: "tool",
        path: "some://unknown/tool",
        title: "Custom Tool",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Use <tool name="tool-1" />`);
    });

    it("translates routes to anchor tags", () => {
      const translator = makeTranslator();
      const content = llm`Go to ${Template.route(
        "Route A",
        "cool-route"
      )}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Go to <a href="/route-1">Route A</a>`);
      const originalRoute = translator.getOriginalRoute("/route-1");
      strictEqual(originalRoute, "cool-route");
    });

    it("ignores malformed routes without instance", () => {
      const translator = makeTranslator();
      const content = llm`Go to ${Template.part({
        type: "tool",
        title: "Route A",
        path: ROUTE_TOOL_PATH,
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Go to `);
    });

    it("translates memory tool to fixed name", () => {
      const translator = makeTranslator();
      const content = llm`Use ${Template.part({
        type: "tool",
        path: "function-group/use-memory",
        title: "Use Memory",
      })}`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Use <tool name="memory" />`);
    });

    it("ignores param type parts", () => {
      const translator = makeTranslator();
      const content = llm`Hello ${Template.part({
        type: "param",
        path: "some-param",
        title: "A Param",
      })} world`.asContent();

      const result = translator.toPidgin(content);
      strictEqual(result.text, `Hello  world`);
    });
  });

  describe("fromPidgin", () => {
    it("parses parent tags in mixed content", () => {
      const result = makeTranslator().fromPidgin(
        `Hello <parent src="node-1" /> world`
      );
      deepStrictEqual(result, {
        parts: [{ text: `Hello <parent src="node-1" /> world` }],
        role: "user",
      });
    });

    it("parses file tags", () => {
      const result = makeTranslator().fromPidgin(
        `See <file src="assets/image.png" />`
      );
      deepStrictEqual(result, {
        parts: [{ text: `See <file src="assets/image.png" />` }],
        role: "user",
      });
    });

    it("parses tool tags", () => {
      const result = makeTranslator().fromPidgin(
        `Use <tool name="get-weather" />`
      );
      deepStrictEqual(result, {
        parts: [{ text: `Use <tool name="get-weather" />` }],
        role: "user",
      });
    });

    it("parses anchor tags", () => {
      const result = makeTranslator().fromPidgin(
        `Go to <a href="/route-1">Route A</a>`
      );
      deepStrictEqual(result, {
        parts: [{ text: `Go to <a href="/route-1">Route A</a>` }],
        role: "user",
      });
    });

    it("handles complex mixed content", () => {
      const input = `Start <parent src="node-1" /> middle <tool name="get-weather" /> end`;
      const result = makeTranslator().fromPidgin(input);
      deepStrictEqual(result, {
        parts: [{ text: input }],
        role: "user",
      });
    });
  });

  describe("reverse lookups", () => {
    it("resolves parent handle to node path", () => {
      const translator = makeTranslator();
      const content = llm`${Template.part({
        type: "in",
        path: "abc-123",
        title: "Input A",
      })}`.asContent();

      translator.toPidgin(content);
      strictEqual(translator.getNodeId("node-1"), "abc-123");
    });

    it("resolves tool name to tool path", () => {
      const translator = makeTranslator();
      const content = llm`${Template.part({
        type: "tool",
        path: "embed://a2/tools.bgl.json#module:get-weather",
        title: "Get Weather",
      })}`.asContent();

      translator.toPidgin(content);
      strictEqual(
        translator.getToolPath("get-weather"),
        "embed://a2/tools.bgl.json#module:get-weather"
      );
    });

    it("returns undefined for unknown handles", () => {
      const translator = makeTranslator();
      strictEqual(translator.getNodeId("node-999"), undefined);
      strictEqual(translator.getToolPath("unknown"), undefined);
      strictEqual(translator.getOriginalRoute("/route-999"), undefined);
    });
  });
});
