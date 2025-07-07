/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditHistoryCreator, GraphDescriptor } from "@breadboard-ai/types";

type Namespace = "board";

export interface Create {
  readonly eventType: `${Namespace}.create`;
  readonly graph: GraphDescriptor;
  readonly editHistoryCreator: EditHistoryCreator;
  readonly messages: {
    start: string;
    end: string;
    error: string;
  };
}

export interface Remix {
  readonly eventType: `${Namespace}.remix`;
  readonly url: string;
  readonly messages: {
    start: string;
    end: string;
    error: string;
  };
}

export interface Delete {
  readonly eventType: `${Namespace}.delete`;
  readonly url: string;
  readonly messages: {
    query: string;
    start: string;
    end: string;
    error: string;
  };
}

export interface Load {
  readonly eventType: `${Namespace}.load`;
  readonly url: string;
}

export interface Run {
  readonly eventType: `${Namespace}.run`;
}

export interface Stop {
  readonly eventType: `${Namespace}.stop`;
  readonly clearLastRun: boolean;
}

export interface Input {
  readonly eventType: `${Namespace}.input`;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly allowSavingIfSecret: boolean;
}

export interface Rename {
  readonly eventType: `${Namespace}.rename`;
  readonly title: string | null;
  readonly description: string | null;
}
