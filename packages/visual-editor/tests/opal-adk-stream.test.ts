import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { buildStreamingRequestBody } from "../src/a2/a2/opal-adk-stream.js";
import { LLMContent } from "@breadboard-ai/types";

describe("buildStreamingRequestBody", () => {
  it("should populate optional fields when provided (Agent Mode)", () => {
    const content: LLMContent[] = [
      { role: "user", parts: [{ text: "hello" }] }
    ];
    const objective: LLMContent = { role: "user", parts: [{ text: "objective" }] };
    const modelConstraint = "text-pro" as const;
    const uiType = "chat";
    const uiPrompt: LLMContent[] = [
      { role: "user", parts: [{ text: "ui prompt" }] }
    ];

    const body = buildStreamingRequestBody({
      content,
      objective,
      modelConstraint,
      uiType,
      uiPrompt: uiPrompt[0]
    });

    deepStrictEqual(body.agent_mode_node_config?.model_constraint, "text-pro");
    strictEqual(body.agent_mode_node_config?.ui_type, "UI_TYPE_CHAT");
    deepStrictEqual(body.agent_mode_node_config?.ui_prompt, uiPrompt[0]);
    deepStrictEqual(body.objective, objective);
    strictEqual(body.node_config, undefined);
  });

  it("should populate optional fields when provided (Legacy Mode)", () => {
    const content: LLMContent[] = [
      { role: "user", parts: [{ text: "hello" }] }
    ];
    const objective: LLMContent = { role: "user", parts: [{ text: "objective" }] };

    const body = buildStreamingRequestBody({
      content,
      objective,
      node_api: "my-node-api"
    });

    strictEqual(body.node_config?.node_api, "my-node-api");
    deepStrictEqual(body.objective, objective);
    strictEqual(body.agent_mode_node_config, undefined);
  });

  it("should omit optional fields when undefined", () => {
    const content: LLMContent[] = [
      { role: "user", parts: [{ text: "hello" }] }
    ];
    const objective: LLMContent = { role: "user", parts: [{ text: "objective" }] };

    const body = buildStreamingRequestBody({
      content,
      objective,
      node_api: "my-node-api"
    });

    strictEqual(body.agent_mode_node_config, undefined);
    strictEqual(body.node_config?.node_api, "my-node-api");
    // objective is always added if passed, and it is passed here (required arg)
    deepStrictEqual(body.objective, objective);
  });
});
