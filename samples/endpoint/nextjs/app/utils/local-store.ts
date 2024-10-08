/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoryListType } from "../types";

const STORY_STORAGE_KEY = "story-teller-stories";

export function getStoryList(): StoryListType[] {
  if (!globalThis.localStorage) {
    return [];
  }
  const storyData = localStorage.getItem(STORY_STORAGE_KEY);
  return storyData ? JSON.parse(storyData) : [];
}

export function rememberStory(story: StoryListType) {
  const storyData = getStoryList();
  localStorage.setItem(
    STORY_STORAGE_KEY,
    JSON.stringify([...storyData, story])
  );
}
