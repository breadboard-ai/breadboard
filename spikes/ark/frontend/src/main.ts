/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ark Frontend — Entry Point
 *
 * Registers the Lit components and mounts <ark-app>.
 */

import "./style.css";
import "./components/ark-app.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<ark-app></ark-app>`;
