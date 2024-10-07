/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import Link from "next/link";
import { StoryListType } from "./types";

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

export default function StoryList() {
  const stories = STORIES;
  return (
    <section>
      <h2 className="pl-5 pt-4 pb-7">Recent Stories</h2>
      <ul className="grid grid-cols-3">
        {stories.map((story) => (
          <li key={story.id} className="p-5 hover:bg-slate-100 rounded-3xl">
            <Link
              href={`/story/${story.id}`}
              className="font-bold text-slate-700"
            >
              <img
                className="block rounded-xl bg-gradient-to-r from-slate-100 to-slate-200"
                width="200"
                height="200"
                src={story.img}
                alt={story.title}
              />
              {story.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
