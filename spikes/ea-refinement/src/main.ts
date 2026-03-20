/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppFrame } from "./app-frame.js";
import { RefinementPanel } from "./refinement-panel.js";
import { ChatStrip } from "./chat-strip.js";
import "./style.css";

const panelEl = document.getElementById("panel")!;
const frameEl = document.getElementById("frames")!;
const chatEl = document.getElementById("chat-strip")!;

const appFrame = new AppFrame(frameEl);
const panel = new RefinementPanel(panelEl, appFrame);
new ChatStrip(chatEl, appFrame, panel);
