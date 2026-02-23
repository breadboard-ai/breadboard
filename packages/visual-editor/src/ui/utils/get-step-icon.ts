/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableNodePorts } from "@breadboard-ai/types";
import { isControllerBehavior } from "../../utils/schema/behaviors.js";
import { iconSubstitute } from "./icon-substitute.js";

export { getStepIcon };

function getStepIcon(
  defaultIcon: string | undefined,
  ports: InspectableNodePorts | undefined
): string | undefined {
  let icon = iconSubstitute(defaultIcon);
  if (!ports) return icon || undefined;
  for (const port of ports.inputs.ports) {
    if (isControllerBehavior(port.schema) && port.schema.enum) {
      const selectedControllerType = port.schema.enum.find((v) => {
        if (typeof v === "string") {
          return false;
        }

        return v.id === port.value;
      });

      if (
        !selectedControllerType ||
        typeof selectedControllerType === "string"
      ) {
        continue;
      }

      if (!selectedControllerType.icon) {
        continue;
      }

      icon = selectedControllerType.icon;
      break;
    }
  }
  return icon || undefined;
}
