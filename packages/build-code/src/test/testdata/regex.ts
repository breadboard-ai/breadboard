/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Inputs = {
  before: string;
};

export type Outputs = {
  after: string;
};

export const run = ({ before }: Inputs): Outputs => {
  const matches = before.matchAll(
    /{{\s*(?<name>[\w-]+)(?:\s*\|\s*(?<op>[\w-]*)(?::\s*"(?<arg>[\w-]+)")?)?\s*}}/g
  );
  const all = Array.from(matches).map((match) => {
    const name = match.groups?.name || "";
    const op = match.groups?.op;
    const arg = match.groups?.arg;
    return { name, op, arg };
  });
  return { after: JSON.stringify(all) };
};
