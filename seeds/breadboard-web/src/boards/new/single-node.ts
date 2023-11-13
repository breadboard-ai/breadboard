/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { core } from "../../new/kits.js";

export const graph = core.passthrough({ foo: "bar" });

// This would be typically used as "await graph", not as a (serialized) graph

export default await graph.serialize({ title: "Single node" });
