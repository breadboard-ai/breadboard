/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoryListType } from "../types";

const STORY_STORAGE_KEY = "story-teller-stories";

const STORIES: StoryListType[] = [
  {
    id: "5967911d-8a1d-46e1-8785-16cd523548d0",
    title: "The Amazing Grace",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
  {
    id: "5d8a59b0-1b91-48f9-9cdc-7ce15886964e",
    title: "Goodbye, world!",
    img: "/1f93e66d-437b-4b33-8a1c-31977ab56109.png",
  },
  {
    id: "00a6b59d-c77f-4cbc-ac84-5f84d9cdfb4f",
    title:
      "Hello, world! Hello, world! Hello, world! Hello, world! Hello, world!",
    img: "/4063c91a-4110-4158-b7ec-2be6fe3fe3cf.png",
  },
  {
    id: "2e575aea-93f6-4422-a60d-f30853ae117b",
    title: "Goodbye, world!",
    img: "/f17cb261-6d5a-4b0d-97fa-46b32ce4a150.png",
  },
  {
    id: "93e7dafb-6533-4bd1-b9e8-4d6141ac6ce2",
    title: "Hello, world!",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
  {
    id: "a807e375-8d21-472e-9ebb-6e2d30c41723",
    title: "Goodbye, world!",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
];

export function getStoryList(): StoryListType[] {
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
