/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Defines the interface between parent iframe and Breadboard.
 * Breadboard doesn't hava a public API, so we communicate over the iframe.
 */

/** A Message from Breadboard to parent iframe, sent via window.parent.postMessage */
export type BreadboardMessage =
  | DebugMessage
  | HandshakeReadyMessage
  | OauthRedirectMessage
  | BackClickedMessage
  | HomeLoadedMessage
  | BoardIdCreatedMessage
  | IterateOnPromptMessage;

/** Event for enabling debug. */
export declare interface DebugMessage {
  type: "debug";
  on: boolean;
}

/** Event when Breadboard has begun listening for messages from parent iframe. */
export declare interface HandshakeReadyMessage {
  type: "handshake_ready";
}

/** Event sent from /oauth. */
export declare interface OauthRedirectMessage {
  type: "oauth_redirect";
  /** If true, the user successfully signed in. */
  success: boolean;
}

/** Event when the user clicks the back button in the view Breadboard page. */
export declare interface BackClickedMessage {
  type: "back_clicked";
}

/** Event when the Breadboard homepage is loaded. */
export declare interface HomeLoadedMessage {
  type: "home_loaded";
  /** If true, the "Sign in" button is not shown. */
  isSignedIn: boolean;
}

/** Event when a new breadboard has been created. */
export declare interface BoardIdCreatedMessage {
  type: "board_id_created";
  /**
   * The id of the newly created Breadboard.
   * Should look like: @focus_obfuscated_gaia_id/filename.bgl.json.
   */
  id: string;
}

/** Event when a new breadboard has been created. */
export declare interface IterateOnPromptMessage {
  type: "iterate_on_prompt";
  /** The title of the node in Breadboard. */
  title: string;
  /**
   * The prompt template to be used in the GenAI playground.
   *
   * Features in this template have a different syntax than in GenAI playground
   * templates. Where in the playground, features have the form
   * {{ feature_name }}, in an  Breadboard prompt template, these have the form:
   *
   * {{ "type": "<type>", "path": "<path>", "title": "<title>" }}.
   *
   * For example: "{{ "type": "param", "path": "feature_name", "title":
   * "Feature Name" }}".
   */
  promptTemplate: string;
  /**
   * The ID of the Breadboard board.
   * Should look like: @focus_obfuscated_gaia_id/filename.bgl.json.
   */
  boardId: string;
  /** The ID of the node in the Breadboard board. */
  nodeId: string;
  /** The model title selected for the prompt. */
  modelId: string | null;
}

/** A message from parent iframe to Breadboard, sent via iframe.contentWindow.postMessage */
export type EmbedderMessage =
  | ToggleIterateOnPromptMessage
  | CreateNewBoardMessage
  | HandshakeCompleteMessage;

/** Message to determine whether to display Iterate-on-prompt button. */
export declare interface ToggleIterateOnPromptMessage {
  type: "toggle_iterate_on_prompt";
  on: boolean;
}

/** Message that creates a new Breadboard board. */
export declare interface CreateNewBoardMessage {
  type: "create_new_board";
  /**
   * Natural language prompt for the new Breadboard.
   * If the string is empty, App Catalyst will not be called.
   */
  prompt: string;
}

/** Message that relays to Breadboard that it's in an parent iframe iframe. */
export declare interface HandshakeCompleteMessage {
  type: "handshake_complete";
  // The top-level origin from parent iframe.
  origin: string;
}

/** Checks if a message is of type HandshakeCompleteMessage. */
export function isHandshakeCompleteMessage(
  message: EmbedderMessage
): message is HandshakeCompleteMessage {
  return message.type === "handshake_complete";
}

export type MessageType = EmbedderMessage["type"];
export type MessageCallback = (
  message: EmbedderMessage
) => Promise<EmbedderMessage | undefined>;

export interface EmbedState {
  showIterateOnPrompt: boolean;
}

export interface EmbedHandler {
  debug: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendToEmbedder(message: BreadboardMessage): Promise<void>;
  subscribe<T extends MessageType>(
    type: T,
    callback: (
      message: Extract<EmbedderMessage, { type: T }>
    ) => Promise<EmbedderMessage | void>
  ): Promise<void>;
  unsubscribe<T extends MessageType>(
    type: T,
    callback: (
      message: Extract<EmbedderMessage, { type: T }>
    ) => Promise<EmbedderMessage | void>
  ): Promise<void>;
}
