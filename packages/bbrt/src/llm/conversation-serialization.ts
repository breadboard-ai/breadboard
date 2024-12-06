/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SerializableBBRTToolCall,
  SerializableBBRTToolResponse,
  SerializableBBRTTurn,
} from "./conversation-serialization-types.js";
import type {
  BBRTToolCall,
  BBRTToolResponse,
  BBRTTurn,
} from "./conversation-types.js";

export function serializeTurns(turns: BBRTTurn[]): SerializableBBRTTurn[] {
  return turns.map(serializeTurn);
}

function serializeTurn(turn: BBRTTurn): SerializableBBRTTurn {
  // TODO(aomarks) It would be really nice if we stored turns in a fully (or at
  // least more easily) serializable way so that we didn't need all this logic.
  if (turn.kind === "user-content") {
    return {
      kind: turn.kind,
      role: turn.role,
      status: turn.status.get(),
      content: turn.content,
    };
  } else if (turn.kind === "user-tool-responses") {
    return {
      kind: turn.kind,
      role: turn.role,
      status: turn.status.get(),
      responses: turn.responses.map(serializeToolResponse),
    };
  } else if (turn.kind === "model") {
    return {
      kind: turn.kind,
      role: turn.role,
      status: turn.status.get(),
      // TODO(aomarks) This is not great. We need a guarantee that the content
      // stream is exhausted.
      content: turn.content.buffer,
      toolCalls: turn.toolCalls
        ? [...turn.toolCalls].map(serializeToolCall)
        : undefined,
      error: turn.error,
    };
  } else if (turn.kind === "error") {
    return {
      kind: "error",
      role: turn.role,
      status: turn.status.get(),
      error: turn.error,
    };
  }
  turn satisfies never;
  const msg =
    `Internal Error: Unhandled turn kind: ` +
    `${JSON.stringify((turn as BBRTTurn).kind)})`;
  console.error(msg);
  throw new Error(msg);
}

function serializeToolResponse(
  response: BBRTToolResponse
): SerializableBBRTToolResponse {
  return {
    id: response.id,
    invocationState: response.invocation.state.get(),
    toolId: response.tool.metadata.id,
    args: response.args,
    response: response.response,
  };
}

function serializeToolCall(call: BBRTToolCall): SerializableBBRTToolCall {
  return {
    id: call.id,
    toolId: call.tool.metadata.id,
    args: call.args,
    invocationState: call.invocation.state.get(),
  };
}
