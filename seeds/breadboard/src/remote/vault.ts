/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeTypeIdentifier,
  NodeValue,
  OutputValues,
} from "../types.js";

export type VaultMatchInputs = {
  [inputName: string]: string | RegExp;
};

export type VaultMatchOutputs = {
  receiver: NodeTypeIdentifier;
  inputs: VaultMatchInputs;
};

export type VaultSecretsSpec = {
  [outputName: string]:
    | VaultMatchOutputs
    | VaultMatchOutputs[]
    | string[]
    | string;
};

export type VaultMatches = {
  [outputName: string]: VaultMatch[];
};

export class VaultMatch implements VaultMatchOutputs {
  constructor(
    readonly outputName: string,
    readonly receiver: NodeTypeIdentifier,
    readonly inputs: VaultMatchInputs = {}
  ) {}

  matches(inputs: InputValues) {
    return Object.entries(this.inputs).every(([inputName, value]) => {
      const inputValue = inputs[inputName];
      if (typeof value === "string") {
        return inputValue === value;
      } else {
        if (typeof inputValue !== "string") return false;
        return value.test(inputValue);
      }
    });
  }
}

export const readSpec = (spec: VaultSecretsSpec): VaultMatches => {
  return Object.fromEntries(
    Object.entries(spec).map(([outputName, value]) => {
      if (typeof value === "string") {
        return [outputName, [new VaultMatch(outputName, value)]];
      } else if (Array.isArray(value)) {
        return [
          outputName,
          value.map((v) => {
            if (typeof v === "string") {
              return new VaultMatch(outputName, v);
            }
            return new VaultMatch(outputName, v.receiver, v.inputs);
          }),
        ];
      } else {
        return [
          outputName,
          [new VaultMatch(outputName, value.receiver, value.inputs)],
        ];
      }
    })
  );
};

type OutputReplacer = (outputName: string, outputValue: NodeValue) => NodeValue;

export const replaceOutputs = (
  outputs: OutputValues,
  matches: VaultMatches,
  replacer: OutputReplacer
): OutputValues => {
  return Object.fromEntries(
    Object.entries(outputs).map(([outputName, value]) => {
      return outputName in matches
        ? [outputName, replacer(outputName, value)]
        : [outputName, value];
    })
  );
};

type InputReplacer = (inputName: string, inputValue: NodeValue) => NodeValue;

export const replaceInputs = (
  node: NodeTypeIdentifier,
  inputs: InputValues,
  matches: VaultMatches,
  replacer: InputReplacer
) => {
  return Object.fromEntries(
    Object.entries(inputs).map(([inputName, value]) => {
      const match = matches[inputName]?.find(
        (match) => match.receiver === node
      );
      if (!match) return [inputName, value];
      if (!match.matches(inputs)) return [inputName, value];
      return [inputName, replacer(inputName, value)];
    })
  );
};

export class Vault {
  #spec: VaultSecretsSpec;
  constructor(spec: VaultSecretsSpec) {
    this.#spec = spec;
  }

  protectOutputs(outputs: void | OutputValues) {
    return outputs;
  }

  revealInputs(inputs: InputValues) {
    return inputs;
  }
}

export class OpenVault {
  protectOutputs(outputs: void | OutputValues) {
    return outputs;
  }

  revealInputs(inputs: InputValues) {
    return inputs;
  }
}
