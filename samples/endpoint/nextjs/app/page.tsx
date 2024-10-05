/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Link from "next/link";
import Form from "./form";

const stories = [
  { title: "Story 1", id: "1" },
  { title: "Story 2", id: "2" },
  { title: "Story 3", id: "3" },
];

export default function Home() {
  return (
    <main className="p-10 grid grid-cols-2">
      <section className="pb-2">
        <h2>Create a new Story</h2>
        <Form />
      </section>
      <section>
        <h2>Recent Stories</h2>
        <ul>
          {stories.map((story) => (
            <li key={story.id}>
              <Link href={`/exploration/${story.id}`}>{story.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
