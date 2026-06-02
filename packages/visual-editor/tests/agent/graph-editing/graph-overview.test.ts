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

  it("shows assets list in YAML when graph has assets", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Test Graph With Assets",
        assets: {
          "/assets/background.png": {
            metadata: {
              title: "Background Image",
              type: "file",
            },
            data: [
              {
                role: "user",
                parts: [{ storedData: { mimeType: "image/png", handle: "foo" } }],
              },
            ],
          },
          "/assets/data.json": {
            metadata: {
              title: "Data Payload",
              type: "content",
              subType: "gdrive",
            },
            data: [
              {
                role: "user",
                parts: [
                  {
                    storedData: {
                      mimeType: "application/vnd.google-apps.spreadsheet",
                      handle: "bar",
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      [],
      [],
      translator
    );

    ok(yaml.includes("assets:"));
    ok(yaml.includes("/assets/background.png:"));
    ok(yaml.includes("title: Background Image"));
    ok(yaml.includes("type: Image"));
    ok(yaml.includes("/assets/data.json:"));
    ok(yaml.includes("title: Data Payload"));
    ok(yaml.includes("type: Google Sheets spreadsheet"));
  });

  it("falls back to raw mimeType when friendly mapping is not found", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Test Graph",
        assets: {
          "/assets/document.pdf": {
            metadata: {
              title: "Specification",
              type: "file",
            },
            data: [
              {
                role: "user",
                parts: [
                  {
                    storedData: {
                      mimeType: "application/pdf",
                      handle: "baz",
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      [],
      [],
      translator
    );
    ok(yaml.includes("type: application/pdf"));
  });

  it("infers YouTube, Google Docs, Slides, Drawing, Plain text, and handle/subType assets accurately", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Comprehensive Type Graph",
        assets: {
          "/asset/yt1": {
            metadata: { title: "yt1", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "video/mp4", handle: "https://www.youtube.com/watch?v=123" } }] }],
          },
          "/asset/yt2": {
            metadata: { title: "yt2", type: "content", subType: "youtube" },
            data: [],
          },
          "/asset/doc": {
            metadata: { title: "doc", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "application/vnd.google-apps.document", handle: "doc1" } }] }],
          },
          "/asset/slide": {
            metadata: { title: "slide", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "application/vnd.google-apps.presentation", handle: "slide1" } }] }],
          },
          "/asset/nl": {
            metadata: { title: "nl", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "application/x-notebooklm", handle: "nl1" } }] }],
          },
          "/asset/pt": {
            metadata: { title: "pt", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "text/plain", handle: "pt1" } }] }],
          },
          "/asset/draw": {
            metadata: { title: "draw", type: "content", subType: "drawing" },
            data: [],
          },
          "/asset/drive_fallback": {
            metadata: { title: "drive_fallback", type: "file" },
            data: [{ role: "user", parts: [{ storedData: { mimeType: "", handle: "drive:/123" } }] }],
          },
        },
      },
      [],
      [],
      translator
    );

    ok(yaml.includes("type: YouTube video"));
    ok(yaml.includes("type: Google Docs document"));
    ok(yaml.includes("type: Google Slides presentation"));
    ok(yaml.includes("type: NotebookLM notebook"));
    ok(yaml.includes("type: Plain text"));
    ok(yaml.includes("type: Drawing"));
    ok(yaml.includes("type: Google Drive file"));
  });

  it("shows x and y coordinates for steps and assets when available", () => {
    const translator = new EditingAgentPidginTranslator();
    const nodes: NodeDescriptor[] = [
      {
        id: "step-1",
        type: GENERATE_COMPONENT_URL,
        metadata: {
          title: "My Positioned Step",
          visual: { x: 100.2, y: 200.8 },
        },
      },
    ];

    const yaml = graphOverviewYaml(
      {
        title: "Test 2D Graph",
        assets: {
          "/assets/logo.png": {
            metadata: {
              title: "My Positioned Image",
              type: "file",
              visual: { x: 50.4, y: 75.9 },
            },
            data: [],
          },
        },
      },
      nodes,
      [],
      translator
    );

    ok(yaml.includes("x: 100"));
    ok(yaml.includes("y: 201"));
    ok(yaml.includes("x: 50"));
    ok(yaml.includes("y: 76"));
  });

  it("includes YAML comment for unpositioned assets", () => {
    const translator = new EditingAgentPidginTranslator();
    const yaml = graphOverviewYaml(
      {
        title: "Test Graph",
        assets: {
          "/assets/doc.txt": {
            metadata: {
              title: "My Unpositioned Doc",
              type: "file",
            },
            data: [],
          },
        },
      },
      [],
      [],
      translator
    );

    ok(yaml.includes("# Newly Added. TODO: Position this asset"));
  });
});

