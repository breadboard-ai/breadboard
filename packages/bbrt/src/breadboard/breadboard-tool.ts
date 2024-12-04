/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asRuntimeKit,
  createDefaultDataStore,
  createLoader,
  type GraphDescriptor,
  type InputValues,
  type OutputValues,
  type SerializedStoredData,
} from "@google-labs/breadboard";
import { createRunner, type RunConfig } from "@google-labs/breadboard/harness";
import CoreKit from "@google-labs/core-kit";
import TemplateKit from "@google-labs/template-kit";
import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import "../components/content.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import type {
  BBRTTool,
  ToolAPI,
  ToolInvocation,
  ToolInvocationState,
  ToolMetadata,
} from "../tools/tool.js";
import type { Result } from "../util/result.js";
import type {
  BreadboardBoardListing,
  BreadboardServer,
} from "./breadboard-server.js";
import { getDefaultSchema } from "./get-default-schema.js";
import { makeToolSafeName } from "./make-tool-safe-name.js";
import { standardizeBreadboardSchema } from "./standardize-breadboard-schema.js";

export class BreadboardTool implements BBRTTool<unknown, unknown> {
  readonly #listing: BreadboardBoardListing;
  readonly #server: BreadboardServer;
  readonly #secrets: SecretsProvider;

  constructor(
    listing: BreadboardBoardListing,
    server: BreadboardServer,
    secrets: SecretsProvider
  ) {
    this.#listing = listing;
    this.#server = server;
    this.#secrets = secrets;
  }

  get metadata(): ToolMetadata {
    return {
      id: makeToolSafeName(this.#server.url + "_" + this.#listing.path),
      title: this.#listing.title,
      description: "TODO",
      icon: "/bbrt/images/tool.svg",
    };
  }

  #api?: Promise<Result<ToolAPI>>;
  async api(): Promise<Result<ToolAPI>> {
    return (this.#api ??= (async () => {
      const bgl = await this.bgl();
      if (!bgl.ok) {
        return bgl;
      }
      const desc = await getDefaultSchema(bgl.value);
      if (!desc.ok) {
        return desc;
      }
      return {
        ok: true,
        value: {
          inputSchema: standardizeBreadboardSchema(desc.value.inputSchema),
          outputSchema: standardizeBreadboardSchema(desc.value.outputSchema),
        },
      };
    })());
  }

  invoke(args: unknown) {
    return new BreadboardToolInvocation(
      this.#listing,
      args,
      () => this.bgl(),
      this.#secrets
    );
  }

  #bglCache?: Promise<Result<GraphDescriptor>>;
  bgl(): Promise<Result<GraphDescriptor>> {
    return (this.#bglCache ??= this.#server.board(this.#listing.path));
  }
}

export class BreadboardToolInvocation implements ToolInvocation<unknown> {
  readonly #listing: BreadboardBoardListing;
  readonly #args: unknown;
  readonly #secrets: SecretsProvider;
  readonly #getBgl: () => Promise<Result<GraphDescriptor>>;

  readonly state = new Signal.State<ToolInvocationState<unknown>>({
    status: "running",
  });

  constructor(
    listing: BreadboardBoardListing,
    args: unknown,
    getBgl: () => Promise<Result<GraphDescriptor>>,
    secrets: SecretsProvider
  ) {
    this.#listing = listing;
    this.#args = args;
    this.#getBgl = getBgl;
    this.#secrets = secrets;
    void this.#start();
  }

  async #start(): Promise<void> {
    const bgl = await this.#getBgl();
    if (!bgl.ok) {
      this.state.set({ status: "error", error: bgl.error });
      return;
    }

    const loader = createLoader();
    const kits = [asRuntimeKit(CoreKit), asRuntimeKit(TemplateKit)];

    const store = createDefaultDataStore();
    const storeGroupID = crypto.randomUUID();
    store.createGroup(storeGroupID);

    const config: RunConfig = {
      // TODO(aomarks) What should this be, it matters for relative imports,
      // right?
      url: `https://example.com/fake`,
      kits,
      runner: bgl.value,
      loader,
      store,
      // Enables the "secret" event.
      interactiveSecrets: true,
      // TODO(aomarks) Provide an abort signal.
    };
    // TODO(aomarks) Support proxying/remote execution.
    const runner = createRunner(config);
    const runResult = await new Promise<Result<OutputValues[]>>(
      (endBoardRun) => {
        const outputs: OutputValues[] = [];
        runner.addEventListener("input", () => {
          // TODO(aomarks) I thought I should be able to pass the inputs to the
          // RunConfig, and/or to the main run call -- but neither seem to work.
          void runner.run(this.#args as InputValues);
        });
        runner.addEventListener("output", (event) => {
          outputs.push(event.data.outputs);
        });
        runner.addEventListener("end", () => {
          endBoardRun({ ok: true, value: outputs });
        });
        runner.addEventListener("error", (event) => {
          endBoardRun({ ok: false, error: event.data.error });
        });
        runner.addEventListener("secret", (event) => {
          void (async () => {
            const secrets: Record<string, string> = {};
            const missing = [];
            const results = await Promise.all(
              event.data.keys.map(
                async (name) =>
                  [name, await this.#secrets.getSecret(name)] as const
              )
            );
            for (const [name, result] of results) {
              if (!result.ok) {
                endBoardRun(result);
                return;
              }
              if (result.value !== undefined) {
                secrets[name] = result.value;
              } else {
                missing.push(name);
              }
            }
            if (missing.length > 0) {
              endBoardRun({
                ok: false,
                error:
                  `Missing secret(s): ${missing.join(", ")}.` +
                  ` Use the Visual Editor Settings to add API keys.`,
              });
              return;
            }
            void runner.run(secrets);
          })();
        });

        void runner.run();
      }
    );

    if (!runResult.ok) {
      this.state.set({ status: "error", error: runResult.error });
      return;
    }
    // TODO(aomarks) Resultify
    const artifacts: SerializedStoredData[] =
      (await store.serializeGroup(storeGroupID)) ?? [];
    this.state.set({
      status: "success",
      value: {
        output: Object.assign({}, ...runResult.value),
        artifacts,
      },
    });
  }

  render() {
    const basicInfo = html`
      <span>${this.#listing.title}</span>
      <pre>${JSON.stringify(this.#args)}</pre>
    `;
    const state = this.state.get();
    switch (state.status) {
      case "running": {
        return [basicInfo, "Running..."];
      }
      case "success": {
        return [basicInfo, "Success"];
      }
      case "error": {
        return [
          basicInfo,
          "Error",
          html` <pre>${JSON.stringify(state.error)}</pre> `,
        ];
      }
      default: {
        state satisfies never;
        console.error("Unexpected state", state);
        return [basicInfo, "Internal error"];
      }
    }
  }

  renderContent() {
    const state = this.state.get();
    if (state.status !== "success") {
      return nothing;
    }
    const artifacts = [];
    for (const artifact of state.value.artifacts) {
      const { mimeType } = artifact.inlineData;
      if (mimeType.startsWith("image/")) {
        artifacts.push(html`<img src="${artifact.handle}" />`);
      } else {
        console.log(
          "Could not display artifact with unsupported MIME type",
          artifact
        );
      }
    }
    return artifacts;
  }
}
