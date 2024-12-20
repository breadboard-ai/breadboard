/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | Array<JsonSerializable>
  | JsonSerializableObject;

export type JsonSerializableObject = { [K: string]: JsonSerializable };
