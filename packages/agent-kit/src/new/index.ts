/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import specialist from "./components/specialist.js";

export default kit({
  title: "Agent Kit (NEW)",
  url: "npm:@google-labs/agent-kit",
  description: "A Breadboard Kit for building agent-like experiences",
  version: "0.0.1",
  components: [specialist],
});
