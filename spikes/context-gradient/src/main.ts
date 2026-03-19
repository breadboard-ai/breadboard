/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppFrame } from "./app-frame.js";
import { GradientPanel } from "./gradient-panel.js";
import "./style.css";

const panelEl = document.getElementById("panel")!;
const frameEl = document.getElementById("frames")!;

const appFrame = new AppFrame(frameEl);
new GradientPanel(panelEl, appFrame);
