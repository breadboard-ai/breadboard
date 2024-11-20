/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asRuntimeKit,
  createLoader,
  type GraphDescriptor,
  type OutputValues,
} from '@google-labs/breadboard';
import {createRunner, type RunConfig} from '@google-labs/breadboard/harness';
import '@google-labs/core-kit';
import CoreKit from '@google-labs/core-kit';
import {html} from 'lit';
import type {Tool} from './tool.js';

export const exampleBreadboardTool: Tool<
  {str: string},
  {reversed: string} | {error: string}
> = {
  displayName: 'Reverse a string',
  icon: '/images/reverse.svg',
  declaration: {
    name: 'reverse_string',
    description: 'Reverses a string',
    parameters: {
      type: 'object',
      properties: {
        str: {
          description: 'The string to reverse',
          type: 'string',
        },
      },
    },
  },
  render: ({str}) => html`
    <span>Reverse string</span>
    <pre>"${str}"</pre>
  `,

  invoke: async (inputs) => {
    // console.log(CoreKit);
    const config: RunConfig = {
      url: `https://example.com/fake`,
      kits: [asRuntimeKit(CoreKit)],
      runner: reverseStringBGL,
      loader: createLoader(),
      inputs,
    };
    const runner = createRunner(config);
    const outputs: OutputValues[] = [];
    await new Promise<void>((resolve, reject) => {
      runner.addEventListener('input', (event) => {
        console.log('bb:input', event);
      });
      runner.addEventListener('output', (event) => {
        outputs.push(event.data.outputs);
        console.log('bb:output', event);
      });
      runner.addEventListener('error', (event) => {
        // TODO(aomarks) Probably bad formatting. Also make sure we are grabbing
        // as much info as possible.
        reject(new Error(JSON.stringify(event.data.error)));
        console.log('bb:error', event);
      });
      runner.addEventListener('end', (event) => {
        console.log('bb:end', event);
        resolve();
      });
      void runner.run(inputs);
    });
    if (outputs.length === 1) {
      return outputs[0] as {reversed: string};
    } else if (outputs.length > 0) {
      return {
        error: `Multiple Breadboard outputs received: ${JSON.stringify(outputs)}`,
      };
    } else {
      return {error: 'No Breadboard outputs received'};
    }
  },
};

// TODO(aomarks) Obviously this shouldn't be hard-coded here.
const reverseStringBGL: GraphDescriptor = {
  title: 'Example Breadboard Graph',
  description: 'Just a trivial example of a Breadboard',
  version: '1.0.0',
  metadata: {},
  edges: [
    {
      from: 'input-0',
      to: 'runJavascript-0',
      out: 'str',
      in: 'str',
    },
    {
      from: 'runJavascript-0',
      to: 'output-0',
      out: 'reversed',
      in: 'reversed',
    },
  ],
  nodes: [
    {
      id: 'input-0',
      type: 'input',
      configuration: {
        schema: {
          type: 'object',
          properties: {
            str: {
              type: 'string',
              title: 'String',
              description: 'The string to reverse',
            },
          },
          required: ['str'],
        },
      },
    },
    {
      id: 'output-0',
      type: 'output',
      configuration: {
        reversed: {
          type: 'object',
          properties: {
            reversed: {
              type: 'string',
              title: 'Reversed String',
              description: 'The reversed string',
            },
          },
          required: ['reversed'],
        },
      },
    },
    {
      id: 'runJavascript-0',
      type: 'runJavascript',
      configuration: {
        code: `const run = ({str}) => ({ reversed: str.split('').reverse().join('') });`,
        raw: true,
      },
    },
  ],
};
