/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tool<I = any, O = any> {
  displayName: string;
  declaration: FunctionDeclaration;
  icon: string;
  invoke: (args: I) => Promise<O>;
  render(args: I): unknown;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: ParameterSchema & {type: 'object'};
}

export type ParameterSchema = {
  description?: string;
  nullable?: boolean;
} & (
  | {type: 'string'; format: 'enum'; enum: string[]}
  | {type: 'string'; format?: undefined}
  | {type: 'number'; format?: 'float' | 'double'}
  | {type: 'boolean'}
  | {
      type: 'array';
      minItems?: number;
      maxItems?: number;
      items?: ParameterSchema;
    }
  | {
      type: 'object';
      required?: string[];
      properties?: Record<string, ParameterSchema>;
    }
);
