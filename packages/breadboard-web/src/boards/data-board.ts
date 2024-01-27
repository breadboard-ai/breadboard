/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

export default await recipe(({ text, n }) => {
  text
    .title("Ad specs")
    .format("multiline")
    .examples(
      `This ad is for my lawn care company that will fit into an inch of newspaper copy. It's called "Max's Lawn Care" and it should use the slogan "I care about your lawn." Emphasize the folksiness of it being a local, sole proprietorship that I started after graduating from high school.`
    );
  n.title("Number of parallel attemps").isNumber().examples("4");

  const { best, list, rank } = core.invoke({
    $id: "bestOfN",
    path: "best-of-n.json",
    agent: "ad-writer.json",
    context: [],
    n,
    text,
  });

  return {
    best: best.title("Best choice"),
    list: list.title("The list of choices"),
    rank: rank.title("Rank and reasoning behind it"),
  };
}).serialize({
  title: "Data Board",
  description: 'An experiment combining "Best of N" and "Ad Writer".',
  version: "0.0.3",
});
