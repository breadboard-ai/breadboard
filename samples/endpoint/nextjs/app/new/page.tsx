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
        <h2 className="font-bold">Tell a New Story</h2>
        <p className="pt-5 text-slate-400">
          Enter the topic around which to build the story. It can be short like
          "the old clock" or long. The Story Teller will use it as inspiration.
        </p>
        <Form></Form>
      </section>
    </main>
  );
}
