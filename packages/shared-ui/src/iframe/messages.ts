/**
 * @fileoverview Defines the interface between parent iframe and Breadboard.
 * Breadboard doesn't hava a public API, so we communicate over the iframe.
 * Everything here is serialized via go/mdn/API/Window/structuredClone.
 *
 * Intended to align with google3/javascript/learning/tfx/autotfx/page_flow_gen/messages.ts.
 */

/** A Message from Breadboard to parent iframe, sent via window.parent.postMessage */
export type BreadboardMessage =
  | HandshakeReadyMessage
  | OauthRedirectMessage
  | BackClickedMessage
  | HomeLoadedMessage
  | BoardIdCreatedMessage
  | IterateOnPromptMessage;

/** Event when Breadboard has begun listening for messages from parent iframe. */
export interface HandshakeReadyMessage {
  type: 'handshake_ready';
}

/** Event sent from /oauth. */
interface OauthRedirectMessage {
  type: 'oauth_redirect';
  /** If true, the user successfully signed in. */
  success: boolean;
}

/** Event when the user clicks the back button in the view Breadboard page. */
interface BackClickedMessage {
  type: 'back_clicked';
}

/** Event when the Breadboard homepage is loaded. */
interface HomeLoadedMessage {
  type: 'home_loaded';
  /** If true, the "Sign in" button is not shown. */
  isSignedIn: boolean;
}

/** Event when a new breadboard has been created. */
interface BoardIdCreatedMessage {
  type: 'board_id_created';
  /**
   * The id of the newly created Breadboard.
   * Should look like: @focus_obfuscated_gaia_id/filename.bgl.json.
   */
  id: string;
}

/** Event when a new breadboard has been created. */
export interface IterateOnPromptMessage {
  type: 'iterate_on_prompt';
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
}

/** A message from parent iframe to Breadboard, sent via iframe.contentWindow.postMessage */
export type IframeMessage = CreateNewBoardMessage | HandshakeCompleteMessage;

/** Message that creates a new Breadboard board. */
export interface CreateNewBoardMessage {
  type: 'create_new_board';
  /**
   * Natural language prompt for the new Breadboard.
   * If the string is empty, App Catalyst will not be called.
   */
  prompt: string;
}

/** Message that relays to Breadboard that it's in an parent iframe iframe. */
export interface HandshakeCompleteMessage {
  type: 'handshake_complete';
  // The top-level origin from parent iframe.
  origin: string;
}

/** Checks if a message is of type HandshakeCompleteMessage. */
export function isHandshakeCompleteMessage(
  message: IframeMessage,
): message is HandshakeCompleteMessage {
  return message.type === 'handshake_complete';
}
