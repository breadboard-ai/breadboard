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
  | IterateOnPromptMessage
  | ResizeMessage;

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

/** 
 * Event to notify the parent of iframe content size change 
 * 
 * Currently only fired from the bb-lite-home component (/?lite=true).
 */
export declare interface ResizeMessage {
  type: "resize";
  height: number;
  width: number;
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

export type MessageType = EmbedderMessage["type"];

export interface EmbedState {
  showIterateOnPrompt: boolean;
}

export interface EmbedHandler extends EventTarget {
  debug: boolean;
  sendToEmbedder(message: BreadboardMessage): Promise<void>;
  addEventListener<T extends MessageType>(
    type: T,
    callback:
      | EmbedderEventTypeToCallback<T>
      | { handleEvent: EmbedderEventTypeToCallback<T> }
      | null,
    options?: AddEventListenerOptions | boolean
  ): void;
}

export type EmbedderMessageEvent<T extends EmbedderMessage> = Event & {
  type: MessageType;
  message: T;
};

type EmbedderEventTypeToCallback<T extends MessageType> = (
  event: EmbedderMessageEvent<EmbedderMessage & { type: T }>
) => void;
