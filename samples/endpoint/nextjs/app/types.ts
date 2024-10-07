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
  id: string;
  topic: string;
  title: string;
  chapters: Chapter[];
};

export type StoryListType = {
  id: string;
  title: string;
  img: string;
};

export type StoryMakingProgress =
  | RejectedStoryProgress
  | ErrorStoryProgress
  | StartStoryProgress
  | DoneStoryProgress
  | ChapterStoryProgress;

export type RejectedStoryProgress = {
  type: "rejected";
  message: string;
};

export type ErrorStoryProgress = {
  type: "error";
  error: string;
};

export type StartStoryProgress = {
  type: "start";
  title: string;
};

export type ChapterStoryProgress = {
  type: "chapter";
  chapter: Chapter;
};

export type DoneStoryProgress = {
  type: "done";
  id: string;
};

export type ProgressEventType = "rejected" | "error" | "start" | "chapter";

export type StoryMakingState =
  | "idle"
  | "starting"
  | "creating"
  | "error"
  | "done";

export type StoryParams = {
  params: {
    story: string;
  };
};

export type ImageParams = {
  params: {
    image: string;
  };
};
