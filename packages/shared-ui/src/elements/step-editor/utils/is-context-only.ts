/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePortList } from "@google-labs/breadboard";
import {
  isBoardArrayBehavior,
  isConfigurableBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../utils";

export function isContextOnly(
  inPorts: InspectablePortList,
  outPorts: InspectablePortList
) {
  if (!inPorts || !outPorts) {
    return true;
  }

  // Confirm that the only non-configurable ports are LLM ones
  for (const inPort of inPorts.ports) {
    if (
      inPort.name === "" ||
      inPort.name === "*" ||
      inPort.star ||
      inPort.name === "$error"
    ) {
      continue;
    }

    if (
      !isConfigurableBehavior(inPort.schema) &&
      !(
        isLLMContentBehavior(inPort.schema) ||
        isLLMContentArrayBehavior(inPort.schema)
      )
    ) {
      if (isBoardArrayBehavior(inPort.schema)) {
        continue;
      }

      return false;
    }
  }

  for (const outPort of outPorts.ports) {
    if (
      outPort.name === "" ||
      outPort.name === "*" ||
      outPort.star ||
      outPort.name === "$error"
    ) {
      continue;
    }

    if (
      !isConfigurableBehavior(outPort.schema) &&
      !(
        isLLMContentBehavior(outPort.schema) ||
        isLLMContentArrayBehavior(outPort.schema)
      )
    ) {
      return false;
    }
  }

  return true;
}
