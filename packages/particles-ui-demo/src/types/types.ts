/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TodoItem {
  title: string;
  done: boolean;
  description?: string;
  dueDate?: Date;
}

export type TodoItems = TodoItem[];
