/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditHistoryCreator, GraphDescriptor } from "@breadboard-ai/types";
import { BaseEventDetail } from "../base";

type Namespace = "board";

export interface Create extends BaseEventDetail<`${Namespace}.create`> {
  readonly graph: GraphDescriptor;
  readonly editHistoryCreator: EditHistoryCreator;
  readonly messages: {
    start: string;
    end: string;
    error: string;
  };
}

export interface Remix extends BaseEventDetail<`${Namespace}.remix`> {
  readonly url: string;
  readonly messages: {
    start: string;
    end: string;
    error: string;
  };
}

export interface Delete extends BaseEventDetail<`${Namespace}.delete`> {
  readonly url: string;
  readonly messages: {
    query: string;
    start: string;
    end: string;
    error: string;
  };
}

export interface Load extends BaseEventDetail<`${Namespace}.load`> {
  readonly url: string;
  readonly shared: boolean;
}

export interface Run extends BaseEventDetail<`${Namespace}.run`> {
  /* Duped to avoid @typescript-eslint/no-empty-object-type */
  readonly eventType: `${Namespace}.run`;
}

export interface Stop extends BaseEventDetail<`${Namespace}.stop`> {
  readonly clearLastRun: boolean;
}

export interface Input extends BaseEventDetail<`${Namespace}.input`> {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly allowSavingIfSecret: boolean;
}

export interface Rename extends BaseEventDetail<`${Namespace}.rename`> {
  readonly title: string | null;
  readonly description: string | null;
}

export interface Replace extends BaseEventDetail<`${Namespace}.replace`> {
  readonly replacement: GraphDescriptor;
  readonly creator: EditHistoryCreator;
}
