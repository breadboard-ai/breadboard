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
