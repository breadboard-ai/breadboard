/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoryParams } from "@/app/types";
import { getStory } from "@/app/utils/store";

export default async function Story({ params }: StoryParams) {
  const story = await getStory(params.story);
  return (
    <main className="p-7">
      <section>
        <h2>{story.title}</h2>
        <ol>
          {story.chapters.map((chapter, index) => (
            <li key={index} className="flex relative items-start my-5">
              <div
                className="absolute top-0 left-0 w-full h-full bg-cover rounded-3xl opacity-30"
                style={{
                  backgroundImage: `url(${chapter.img})`,
                  backgroundSize: "cover",
                }}
              ></div>
              <img
                src={chapter.img}
                className="relative ml-5 mt-5 rounded-xl shadow-2xl"
                width={300}
                height={300}
                alt={`Chapter ${index + 1}`}
              />
              <h3
                className="relative px-5 py-3 m-5 rounded-xl"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {chapter.text}
              </h3>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
