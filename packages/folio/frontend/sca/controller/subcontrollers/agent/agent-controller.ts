/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Agent } from "../../../types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * The Agent Controller for Folio.
 */
export class AgentController extends RootController {
  @field({ deep: true })
  accessor agents: Agent[] = [
    {
      id: "top-level-agent",
      name: "Top Level Agent",
      bgColor: "#AEAEAE",
      fgColor: "#525252",
      count: 0,
    },
    {
      id: "agent-2",
      name: "Creative Agent",
      bgColor: "#C27A6E",
      fgColor: "#6C3E38",
      count: 2,
    },
    {
      id: "agent-3",
      name: "Research Agent",
      bgColor: "#A07B9F",
      fgColor: "#5A3E58",
      count: 3,
    },
    {
      id: "agent-1",
      name: "Search Agent",
      bgColor: "#8A8B45",
      fgColor: "#4C4D22",
      count: 1,
    },
  ];

  constructor() {
    super("Agent", "AgentController");
  }
}
