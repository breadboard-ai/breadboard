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

// Compute a simple hash that expires every 7 days.
// The point of this hash is not protect anything, but rather to have
// a simple way to identify a string that represents a protected value.
// It is also rotating so that the users of the node proxy don't accidentally
// adopt bad practices of hard-coding the values.
// Note: the rotation is not window-based, so it will occasionaly cause errors
// at the break of the week.
// TODO: Fix the rotation to be window-based or come up with an even better
// solution.
const expirationHash = Math.round(Date.now() / 1000 / 60 / 60 / 7).toString(36);
const PROTECTED_PREFIX = `VAULT-${expirationHash}-`;

export const getProtectedValue = (
  nodeType: NodeTypeIdentifier,
  outputName: string
) => {
  return `${PROTECTED_PREFIX}${nodeType}-${outputName}`;
};

export class Vault {
  #spec: VaultMatches;
  #nodeType: NodeTypeIdentifier;

  constructor(nodeType: NodeTypeIdentifier, spec: VaultSecretsSpec) {
    this.#spec = readSpec(spec);
    this.#nodeType = nodeType;
  }

  protectOutputs(outputs: void | OutputValues) {
    if (!outputs) return outputs;
    return replaceOutputs(outputs, this.#spec, (name) =>
      getProtectedValue(this.#nodeType, name)
    );
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
