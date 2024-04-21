/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableRun,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";

const isInput = (
  event: InspectableRunEvent
): event is InspectableRunNodeEvent => {
  return (
    event.type === "node" &&
    event.node.descriptor.type === "input" &&
    event.end !== null
  );
};

export type InputsFromRun = Map<string, OutputValues[]>;

export const inputsFromRun = (run?: InspectableRun): InputsFromRun | null => {
  if (!run) return null;

  const result: InputsFromRun = new Map();
  run.events.forEach((event) => {
    if (!isInput(event)) return;
    const id = event.node.descriptor.id;
    let inputList = result.get(id);
    if (!inputList) {
      inputList = [];
      result.set(id, inputList);
    }
    inputList.push(event.outputs || {});
  });

  return result.size > 0 ? result : null;
};

export const valuesFromLastRun = (
  id: string,
  schema: Schema,
  inputs: InputsFromRun | null
) => {
  if (!inputs) return schema;
  const input = inputs.get(id);
  if (!input) return schema;
  // TODO: Implement support for multiple iterations over the
  // same input over a run. Currently, we will only grab the
  // first value.
  const values = input[0];
  if (!values) return schema;
  const result = structuredClone(schema);
  Object.entries(result.properties || {}).forEach(([property, schema]) => {
    schema.examples = [values[property] as string];
  });
  return result;
};
