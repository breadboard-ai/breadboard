/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asRuntimeKit,
  createLoader,
  inspect,
  type GraphDescriptor,
  type InputValues,
  type OutputValues,
} from '@google-labs/breadboard';
import {createRunner, type RunConfig} from '@google-labs/breadboard/harness';
import CoreKit from '@google-labs/core-kit';
import TemplateKit from '@google-labs/template-kit';
import {html} from 'lit';
import type {
  GeminiFunctionDeclaration,
  GeminiParameterSchema,
} from '../llm/gemini.js';
import type {SecretsProvider} from '../secrets/secrets-provider.js';
import type {BBRTTool} from '../tools/tool.js';
import type {Result} from '../util/result.js';
import type {
  BreadboardBoardListing,
  BreadboardServer,
} from './breadboard-server.js';

export class BreadboardTool implements BBRTTool<InputValues, OutputValues> {
  readonly listing: BreadboardBoardListing;
  readonly #server: BreadboardServer;
  // TODO(aomarks) More kits.
  readonly #loader = createLoader();
  readonly #kits = [asRuntimeKit(CoreKit), asRuntimeKit(TemplateKit)];
  readonly #secrets: SecretsProvider;

  constructor(
    board: BreadboardBoardListing,
    server: BreadboardServer,
    secrets: SecretsProvider,
  ) {
    this.listing = board;
    this.#server = server;
    this.#secrets = secrets;
  }

  get displayName() {
    return this.listing.title;
  }

  get icon() {
    return '/images/tool.svg';
  }

  render(inputs: Record<string, unknown>) {
    // prettier-ignore
    return html`
      <span>${this.listing.title}</span>
      <pre>${JSON.stringify(inputs)}</pre>
    `;
  }

  #bglCache?: Promise<GraphDescriptor>;
  #bgl(): Promise<GraphDescriptor> {
    return (this.#bglCache ??= this.#server.board(this.listing.path));
  }

  async declaration(): Promise<GeminiFunctionDeclaration> {
    const bgl = await this.#bgl();
    // Gemini requires [a-zA-Z0-9_\-\.]{1,64}.
    // OpenAI requires [a-zA-Z0-9_\-]{1,??}
    const name = this.listing.path
      .replace(/[^a-zA-Z0-9_\\-]/g, '')
      .slice(0, 64);
    const {inputSchema} = await inspect(bgl, {
      kits: this.#kits,
      loader: this.#loader,
    }).describe({});
    return {
      name,
      description:
        this.listing.title + (bgl.description ? `: ${bgl.description}` : ''),
      // TODO(aomarks) We may need to strip non-standard Breadboard annotations
      // in the JSON Schema.
      parameters: inputSchema as GeminiParameterSchema,
    };
  }

  async invoke(inputs: InputValues): Promise<Result<OutputValues>> {
    const bgl = await this.#bgl();
    console.log('BREADBOARD INVOKE', {inputs, bgl});
    const config: RunConfig = {
      // TODO(aomarks) What should this be, it matters for relative imports,
      // right?
      url: `https://example.com/fake`,
      kits: this.#kits,
      runner: bgl,
      loader: this.#loader,
      // Enables the "secret" event.
      interactiveSecrets: true,
      // TODO(aomarks) Provide an abort signal.
    };
    // TODO(aomarks) Support proxying/remote execution.
    const runner = createRunner(config);
    const runResult = await new Promise<Result<OutputValues[]>>(
      (endBoardRun) => {
        const outputs: OutputValues[] = [];
        runner.addEventListener('input', (event) => {
          console.log('BREADBOARD INPUT', event.data, runner.inputSchema());
          // TODO(aomarks) I thought I should be able to pass the inputs to the
          // RunConfig, and/or to the main run call -- but neither seem to work.
          void runner.run(inputs);
        });
        runner.addEventListener('output', (event) => {
          console.log('BREADBOARD OUTPUT', event.data.outputs);
          outputs.push(event.data.outputs);
        });
        runner.addEventListener('end', () => {
          console.log('BREADBOARD END');
          endBoardRun({ok: true, value: outputs});
        });
        runner.addEventListener('error', (event) => {
          console.log('BREADBOARD ERROR', event.data.error);
          endBoardRun({ok: false, error: event.data.error});
        });
        runner.addEventListener('secret', (event) => {
          console.log('BREADBOARD SECRET', event.data.keys);
          void (async () => {
            const secrets: Record<string, string> = {};
            const missing = [];
            const results = await Promise.all(
              event.data.keys.map(
                async (name) =>
                  [name, await this.#secrets.getSecret(name)] as const,
              ),
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
                  `Missing secret(s): ${missing.join(', ')}.` +
                  ` Use the Visual Editor Settings to add API keys.`,
              });
              return;
            }
            void runner.run(secrets);
          })();
        });

        void runner.run();
      },
    );
    console.log('BREADBOARD RUN DONE', runResult);

    if (!runResult.ok) {
      return runResult;
    }
    const outputs = runResult.value;
    if (outputs.length === 1) {
      return {ok: true, value: outputs[0]!};
    } else if (outputs.length > 0) {
      return {
        ok: false,
        error: `Multiple Breadboard outputs received: ${JSON.stringify(outputs)}`,
      };
    } else {
      return {ok: false, error: 'No Breadboard outputs received'};
    }
  }
}
