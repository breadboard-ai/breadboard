/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Chapter = {
  text: string;
  img: string;
};

export type StoryType = {
  title: string;
  chapters: Chapter[];
};

export type StoryListType = {
  id: number;
  title: string;
  img: string;
};
