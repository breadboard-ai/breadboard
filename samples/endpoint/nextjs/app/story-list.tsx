/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStoryList } from "./utils/local-store";

export default function StoryList() {
  const router = useRouter();
  const stories = getStoryList();
  if (stories.length === 0) {
    router.push("/new");
    return;
  }

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
