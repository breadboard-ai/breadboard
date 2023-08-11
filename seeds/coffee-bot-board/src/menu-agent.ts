/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const menuAgentTemplate = new Template("v2-multi-agent", board, kit);
const menu = await menuAgentTemplate.loadTemplate("menu-agent.txt");
await menuAgentTemplate.wirePart("menu", "json");
