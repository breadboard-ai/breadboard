/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import AgentKit from "@google-labs/agent-kit/agent.kit.json" assert { type: "json" };
import {
  asRuntimeKit,
  createDefaultDataStore,
  createLoader,
  type DataStore,
  type GraphDescriptor,
  type InputValues,
  type Kit,
  type OutputValues,
} from "@google-labs/breadboard";
import { createRunner, type RunConfig } from "@google-labs/breadboard/harness";
import { kitFromGraphDescriptor } from "@google-labs/breadboard/kits";
import CoreKit from "@google-labs/core-kit";
import GeminiKit from "@google-labs/gemini-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import { Signal } from "signal-polyfill";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { ArtifactStore } from "../artifacts/artifact-store.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import type {
  BBRTTool,
  BBRTToolAPI,
  BBRTToolExecuteResult,
  BBRTToolMetadata,
} from "../tools/tool-types.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import {
  coercePresentableError,
  type PresentableError,
} from "../util/presentable-error.js";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { transposeResults } from "../util/transpose-results.js";
import type {
  BreadboardBoardListing,
  BreadboardServiceClient,
} from "./breadboard-server.js";
import { getDefaultSchema } from "./get-default-schema.js";
import { makeToolSafeName } from "./make-tool-safe-name.js";
import { standardizeBreadboardSchema } from "./standardize-breadboard-schema.js";

export class BreadboardTool implements BBRTTool {
  readonly #listing: BreadboardBoardListing;
  readonly #server: BreadboardServiceClient;
  readonly #secrets: SecretsProvider;
  readonly #artifacts: ArtifactStore;

  constructor(
    listing: BreadboardBoardListing,
    server: BreadboardServiceClient,
    secrets: SecretsProvider,
    artifacts: ArtifactStore
  ) {
    this.#listing = listing;
    this.#server = server;
    this.#secrets = secrets;
    this.#artifacts = artifacts;
  }

  get metadata(): BBRTToolMetadata {
    return {
      id: makeToolSafeName(this.#server.url + "_" + this.#listing.path),
      title: this.#listing.title,
      description: "TODO",
      icon: "/bbrt/images/tool.svg",
    };
  }

  #api?: Promise<Result<BBRTToolAPI>>;
  async api(): Promise<Result<BBRTToolAPI>> {
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

  execute(args: JsonSerializableObject) {
    return {
      result: this.#execute(args),
    };
  }

  async #execute(
    args: JsonSerializableObject
  ): Promise<
    Result<{ data: JsonSerializableObject; artifacts: ArtifactHandle[] }>
  > {
    // TODO(aomarks) Clean this up.
    const invocation = new BreadboardToolInvocation(
      args,
      () => this.bgl(),
      this.#secrets,
      this.#artifacts
    );
    // TODO(aomarks) Broadly rethink this. Executions should be a stream of
    // events, and those should be saved in state too.
    await invocation.start();
    const state = invocation.state.get();
    if (state.status === "success") {
      return {
        ok: true,
        value: {
          data: state.value.output as JsonSerializableObject,
          artifacts: state.value.artifacts,
        },
      };
    } else if (state.status === "error") {
      return { ok: false, error: state.error };
    } else {
      state.status satisfies "running" | "unstarted";
      return { ok: false, error: `Internal error: state was ${state.status}` };
    }
  }

  #bglCache?: Promise<Result<GraphDescriptor>>;
  bgl(): Promise<Result<GraphDescriptor>> {
    return (this.#bglCache ??= this.#server.board(this.#listing.path));
  }
}

type InvocationState<O = unknown> =
  | { status: "unstarted" }
  | { status: "running" }
  | {
      status: "success";
      value: BBRTToolExecuteResult<O>;
    }
  | { status: "error"; error: PresentableError };

export class BreadboardToolInvocation {
  readonly #args: unknown;
  readonly #secrets: SecretsProvider;
  readonly #getBgl: () => Promise<Result<GraphDescriptor>>;
  readonly #artifacts: ArtifactStore;

  readonly state = new Signal.State<InvocationState<unknown>>({
    status: "unstarted",
  });

  constructor(
    args: unknown,
    getBgl: () => Promise<Result<GraphDescriptor>>,
    secrets: SecretsProvider,
    artifacts: ArtifactStore
  ) {
    this.#args = args;
    this.#getBgl = getBgl;
    this.#secrets = secrets;
    this.#artifacts = artifacts;
  }

  async start(): Promise<void> {
    if (this.state.get().status !== "unstarted") {
      return;
    }
    this.state.set({ status: "running" });
    const bgl = await this.#getBgl();
    if (!bgl.ok) {
      this.state.set({
        status: "error",
        error: coercePresentableError(bgl.error),
      });
      return;
    }

    const loader = createLoader();
    const kits: Kit[] = [
      asRuntimeKit(CoreKit),
      asRuntimeKit(TemplateKit),
      asRuntimeKit(JSONKit),
      asRuntimeKit(GeminiKit),
      kitFromGraphDescriptor(AgentKit as GraphDescriptor)!,
    ];

    const store = createDefaultDataStore();
    const storeGroupId = crypto.randomUUID();
    store.createGroup(storeGroupId);

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
      this.state.set({
        status: "error",
        error: coercePresentableError(runResult.error),
      });
      return;
    }

    const artifacts = await this.#extractAndStoreArtifacts(store, storeGroupId);
    if (!artifacts.ok) {
      this.state.set({
        status: "error",
        error: coercePresentableError(artifacts.error),
      });
      return;
    }
    this.state.set({
      status: "success",
      value: {
        output: Object.assign({}, ...runResult.value),
        artifacts: artifacts.value,
      },
    });
  }

  async #extractAndStoreArtifacts(
    store: DataStore,
    storeGroupId: string
  ): Promise<Result<ArtifactHandle[]>> {
    // TODO(aomarks) This is a bit inefficient, since serializeGroup does its
    // own fetch and base64 encode into inline data. Should probably add a
    // method to DataStore that just lists all the handles.
    const storedData = await resultify(store.serializeGroup(storeGroupId));
    if (!storedData.ok) {
      return storedData;
    }
    if (!storedData.value || storedData.value.length === 0) {
      return { ok: true, value: [] };
    }
    const blobs = await resultify(
      Promise.all(
        storedData.value.map(async (data) => (await fetch(data.handle)).blob())
      )
    );
    if (!blobs.ok) {
      return blobs;
    }
    return transposeResults(
      await Promise.all(
        blobs.value.map(async (blob) => {
          const artifactId = crypto.randomUUID();
          const entry = this.#artifacts.entry(artifactId);
          using transaction = await entry.acquireExclusiveReadWriteLock();
          const write = await transaction.write(blob);
          if (!write.ok) {
            return write;
          }
          return {
            ok: true,
            value: {
              id: artifactId,
              kind: "handle",
              mimeType: blob.type,
            },
          };
        })
      )
    );
  }
}
