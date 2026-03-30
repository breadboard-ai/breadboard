/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RootController } from "./root-controller.js";
import type { ChatMessage, ChatThread } from "../../types.js";
import { field } from "../decorators/field.js";
import type { Choice } from "../../../utils.js";

export class ChatController extends RootController {
  constructor() {
    super("chat", "chat");
  }

  @field() accessor isOpen = false;
  @field() accessor input = "";
  @field({ deep: true }) accessor threads: ChatThread[] = [];
  @field() accessor activeThreadId = "opie";
  @field({ deep: true }) accessor threadMessages = new Map<
    string,
    ChatMessage[]
  >();
  @field({ deep: true }) accessor pendingChoices: Choice[] = [];
  @field() accessor pendingSelectionMode: "single" | "multiple" = "single";
  @field({ deep: true }) accessor selectedChoiceIds: string[] = [];
  @field({ deep: true }) accessor restoredThreadIds = new Set<string>();
  @field({ deep: true }) accessor visitedThreadIds = new Set<string>(["opie"]);
  @field({ deep: true }) accessor previousTicketStatuses = new Map<
    string,
    string
  >();
}
