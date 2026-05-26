/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { ok } from "node:assert";
import { graphOverviewYaml } from "../../../src/a2/agent/graph-editing/graph-overview.js";
import { EditingAgentPidginTranslator } from "../../../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import type { NodeDescriptor, Edge } from "@breadboard-ai/types";

const GENERATE_COMPONENT_URL = "embed://a2/generate.bgl.json#module:main";
const USER_INPUT_COMPONENT_URL =
  "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c";
const OUTPUT_COMPONENT_URL =
  "embed://a2/a2.bgl.json#module:render-outputs";

describe("graphOverviewYaml", () => {
  it("shows options for legacy step types", () => {
    const translator = new EditingAgentPidginTranslator();
    const nodes: NodeDescriptor[] = [
      {
        id: "node-in",
        type: USER_INPUT_COMPONENT_URL,
        metadata: { title: "My User Input" },
        configuration: {
          description: {
            parts: [{ text: "Enter your prompt" }],
            role: "user",
          },
          "p-modality": "Image",
          "p-required": true,
        },
      },
      {
        id: "node-out",
        type: OUTPUT_COMPONENT_URL,
        metadata: { title: "My Output" },
        configuration: {
          text: {
            parts: [{ text: "Final result" }],
            role: "user",
          },
          "p-render-mode": "google-doc",
          "b-doc-title": "My Doc Title",
        },
      },
      {
        id: "node-flash",
        type: GENERATE_COMPONENT_URL,
        metadata: { title: "My Flash Generation" },
        configuration: {
          "generation-mode": "text-3-flash",
          config$prompt: {
            parts: [{ text: "Translate hello to French" }],
            role: "user",
          },
          "b-system-instruction": "Always respond in French",
        },
      },
    ];

    const edges: Edge[] = [];

    const yaml = graphOverviewYaml(
      { title: "Test Graph", description: "This is a test description" },
      nodes,
      edges,
      translator
    );

    ok(yaml.includes("options:"));
    ok(yaml.includes('modality: "Image"'));
    ok(yaml.includes("required: true"));
    ok(yaml.includes('render_mode: "google-doc"'));
    ok(yaml.includes('doc_title: "My Doc Title"'));
    ok(yaml.includes('system_instruction: "Always respond in French"'));
    ok(yaml.includes("Enter your prompt"));
    ok(yaml.includes("Final result"));
    ok(yaml.includes("Translate hello to French"));
  });

  it("shows splashImage: present when graph has custom splashScreen", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Test Graph",
        metadata: {
          visual: {
            presentation: {
              theme: "theme-1",
              themes: {
                "theme-1": {
                  splashScreen: {
                    storedData: {
                      handle: "some-handle",
                      mimeType: "image/png",
                    },
                  },
                  isDefaultTheme: false,
                },
              },
            },
          },
        },
      },
      [],
      [],
      translator
    );
    ok(yaml.includes("splashImage: present"));
  });

  it("shows splashImage: default when graph lacks splashScreen or is default theme", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Test Graph",
        metadata: {
          visual: {
            presentation: {
              theme: "theme-1",
              themes: {
                "theme-1": {
                  isDefaultTheme: true,
                },
              },
            },
          },
        },
      },
      [],
      [],
      translator
    );
    ok(yaml.includes("splashImage: default"));
  });
});

