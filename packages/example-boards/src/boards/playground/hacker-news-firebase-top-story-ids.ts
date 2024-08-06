/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  array,
  board,
  input,
  output,
} from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";

const limitInput = input({
  type: "number",
  title: "Number of story IDs to return",
  description: "The number of Hacker News Top story IDs to return",
  examples: [5]
})

const fetchOutput = fetch({
  $id: "fetch",
  method: "GET",
  url: "https://hacker-news.firebaseio.com/v0/topstories.json",
})

const passThrough = code({
  $id: "passThrough",
  object: fetchOutput.outputs.response,
},
  {
    object: array("number")
  },
  ({ object }) => {
    return { object } as any;
  }
)

const sliceOutput = code({
  $id: "sliceOutput",
  limit: limitInput,
  list: passThrough.outputs.object
},
  {
    sliced: "unknown"
  }, ({ limit, list }) => {
    return { sliced: list?.slice(0, limit) };
  })

export default board({
  title: "Hacker News Firebase Top Story IDs",
  description: "Board which returns Top Story IDs of Hacker News Story Posts using the Firebase API",
  version: "0.1.0",
  inputs: {
    limitInput,
  },
  outputs: {
    storyIDs: output(sliceOutput.outputs.sliced)
  }
})