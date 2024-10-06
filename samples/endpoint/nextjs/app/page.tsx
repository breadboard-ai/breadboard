/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Link from "next/link";
import { StoryListType } from "./types";

const STORIES: StoryListType[] = [
  {
    id: 1,
    title: "The Amazing Grace",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
  {
    id: 2,
    title: "Goodbye, world!",
    img: "/1f93e66d-437b-4b33-8a1c-31977ab56109.png",
  },
  {
    id: 3,
    title:
      "Hello, world! Hello, world! Hello, world! Hello, world! Hello, world!",
    img: "/4063c91a-4110-4158-b7ec-2be6fe3fe3cf.png",
  },
  {
    id: 4,
    title: "Goodbye, world!",
    img: "/f17cb261-6d5a-4b0d-97fa-46b32ce4a150.png",
  },
  {
    id: 5,
    title: "Hello, world!",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
  {
    id: 6,
    title: "Goodbye, world!",
    img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
  },
];

export default function Home() {
  const stories = STORIES;
  return (
    <main className="p-3">
      <section>
        <h2 className="pl-5 pt-4 pb-7">Recent Stories</h2>
        <ul className="grid grid-cols-3">
          {stories.map((story) => (
            <li key={story.id} className="p-5 hover:bg-slate-100 rounded-xl">
              <Link
                href={`/story/${story.id}`}
                className="font-bold text-slate-700"
              >
                <img
                  className="block rounded-lg bg-gradient-to-r from-slate-100 to-slate-200"
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
    </main>
  );
}
