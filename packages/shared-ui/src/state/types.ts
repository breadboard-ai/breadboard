/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";

export type ChatStatus = "running" | "paused" | "stopped";

export type ChatUserTurnState = {
  role: "user";
  content: ChatContent[];
};

export type ChatTextContent = {
  title: string;
  format?: "text" | "markdown";
  text: string;
};

export type ChatLLMContent = {
  title: string;
  context: LLMContent[];
};

export type ChatContent = ChatTextContent | ChatLLMContent;

/**
 * Represents the system entry in the chat conversation between the
 * user and the system (Breadboard).
 * Typically, the role = "model", but here, we're defining it more broadly
 * so we'll name it "system."
 */
export type ChatSystemTurnState = {
  role: "system";
  /**
   * The icon representing the participant.
   */
  icon: string;
  /**
   * The friendly name of the participant.
   */
  name: string;
  /**
   * The content of the turn. May contain multiple messages.
   */
  content: ChatContent[];
};

export type ChatConversationState = ChatUserTurnState | ChatSystemTurnState;

export type ChatState = {
  conversation: ChatConversationState[];
  status: ChatStatus;
};
