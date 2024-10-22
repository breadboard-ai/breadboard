/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ParsedHeading = {
  type: "heading";
  text: string;
  level: number;
} & ParsedLineRange;

export type ParsedText = {
  type: "text";
  text: string;
} & ParsedLineRange;

export type ParsedBullet = {
  type: "bullet";
  text: string;
  level: number;
} & ParsedLineRange;

export type ParsedLineRange = {
  start: number;
  end: number;
};

export type ParsedLine = ParsedHeading | ParsedBullet | ParsedText;

export type Cursor = {
  pos: number;
};
