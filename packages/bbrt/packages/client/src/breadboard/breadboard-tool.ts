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

  constructor(board: BreadboardBoardListing, server: BreadboardServer) {
    this.listing = board;
    this.#server = server;
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
    console.log('bb:inputSchema', this.displayName, inputSchema);
    return {
      name,
      description:
        this.listing.title + (bgl.description ? `: ${bgl.description}` : ''),
      // TODO(aomarks) We may need to strip non-standard Breadboard annotations
      // in the JSON Schema.
      parameters: inputSchema as unknown as GeminiParameterSchema & {
        type: 'object';
      },
    };
  }

  async invoke(inputs: InputValues): Promise<Result<OutputValues>> {
    const bgl = await this.#bgl();
    // TODO(aomarks) Support remote execution
    const config: RunConfig = {
      // TODO(aomarks) What should this be, it matters for relative imports,
      // right?
      url: `https://example.com/fake`,
      kits: this.#kits,
      runner: bgl,
      loader: this.#loader,
      inputs,
    };

    const runner = createRunner(config);
    const outputs: OutputValues[] = [];
    let error: unknown;
    await new Promise<void>((resolve) => {
      runner.addEventListener('output', (event) => {
        outputs.push(event.data.outputs);
      });
      runner.addEventListener('error', (event) => {
        error = event.data.error;
        resolve();
      });
      runner.addEventListener('end', () => {
        resolve();
      });
      void runner.run(inputs);
    });
    console.log('BREADBOARD DONE', {outputs, error});

    if (error !== undefined) {
      return {ok: false, error};
    }

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
