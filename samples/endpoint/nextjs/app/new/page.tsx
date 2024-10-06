/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Form from "./form";

export default function New() {
  return (
    <main className="p-7">
      <section>
        <h2 className="font-bold">Start a New Story</h2>
        <p className="pt-5 text-slate-500">
          Enter the topic for the story. It can be something very short like
          "the old clock" or as long as you desire. The Story Teller will use
          all of it as inspiration.
        </p>
        <Form></Form>
      </section>
    </main>
  );
}
