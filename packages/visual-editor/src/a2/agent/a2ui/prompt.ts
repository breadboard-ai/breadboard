/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../../a2/utils";

export const prompt = tr`

To interact with the user, rely on functions that start with "ui_ask_user_". These functions are designed to present consistent user interface to the user, and all you need to do is to choose the right funciton and supply the necessary parameters. Once such a function function is called, it blocks until the user interacts with it, making a selection or entering text. The function then returns back with the outcomes of user's interaction.

`;
