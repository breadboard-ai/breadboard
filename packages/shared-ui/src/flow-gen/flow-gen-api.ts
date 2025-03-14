/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor as FlowDefinition } from "@breadboard-ai/types";

export type FlowGenRequest = {
  /** User's natural language description of the flow or change to make. */
  intent: string;

  context?: {
    /** User's current flow. If missing, we're creating a new flow. */
    flow?: FlowDefinition;

    /** Any relevant previous chat history (not including the latest intent). */
    chat?: FlowGenChatTurn[];
  };

  /**
   * Optional hard constraints on what can be created or changed.
   *
   * When constraints are missing or empty, an arbitrarily different flow to the
   * current one could be generated.
   *
   * When there are one or more constraints, a modification will only be made to
   * the flow if it matches at least one of the constraints.
   */
  constraints?: FlowGenConstraint[];

  /**
   * Whether the user is able to engage in interactive chat with the model in
   * relation to this request, in case the request is unclear.
   *
   * When true, a FOLLOWUP response will be returned when the request is
   * unclear, thus initiating an interactive chat session.
   *
   * When false or missing, an ERROR response will be returned when the request
   * is unclear.
   *
   * Note that the length of a chat session can be controlled by setting this
   * property to true at first, and later to false when the maximum length has
   * been reached.
   */
  allowFollowup?: boolean;
};

export type FlowGenConstraint =
  | {
      kind: "EDIT_STEP_CONFIG";
      stepId: string;
      /** If missing or empty, any config property may be changed. */
      propertyIds?: string[];
    }
  | {
      kind: "ADD_STEP_BEFORE";
      before: {
        stepId: string;
        inputPortId: string;
      };
    }
  | {
      kind: "ADD_STEP_AFTER";
      after: {
        stepId: string;
        outputPortId: string;
      };
    };

export type FlowGenResponse =
  | FlowGenOKResponse
  | FlowGenFollowupResponse
  | FlowGenErrorResponse;

export type FlowGenOKResponse = {
  kind: "OK";
  flow: FlowDefinition;
  /** Optional natural language response explaining to the user what changed. */
  message?: string;
};

export type FlowGenFollowupResponse = {
  kind: "FOLLOWUP";
  message: string;
};

export type FlowGenErrorResponse = {
  kind: "ERROR";
  code: "AMBIGUOUS" | "INTERNAL" /* etc. */;
  message: string;
};

export type FlowGenChatTurn =
  | { role: "user"; content: string }
  | { role: "model"; content: string };
