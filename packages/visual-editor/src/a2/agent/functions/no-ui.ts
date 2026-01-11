/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../../a2/utils.js";
import { emptyDefinitions } from "../function-definition.js";
import { FunctionGroup } from "../types.js";
import { FAILED_TO_FULFILL_FUNCTION } from "./system.js";

export { getNoUiFunctionGroup };

const instruction = tr`

## Interacting with the User

You do not have a way to interact with the user during this session. If the objective calls for ANY user interaction, like asking user for input or presenting output and asking user to react to it, call the "${FAILED_TO_FULFILL_FUNCTION}" function, since that's beyond your current capabilities.

`;

function getNoUiFunctionGroup(): FunctionGroup {
  return { ...emptyDefinitions(), instruction };
}
