/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Form from "./form";
import GenerateStory from "./generate-story";

export default function New() {
  return (
    <main className="p-7">
      <section>
        <GenerateStory></GenerateStory>
      </section>
    </main>
  );
}
