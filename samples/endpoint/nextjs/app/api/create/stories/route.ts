/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const STORIES = [
  { id: 1, title: "Hello, world!", img: "https://picsum.photos/200" },
  { id: 2, title: "Goodbye, world!", img: "https://picsum.photos/200" },
];

export async function GET(req: Request) {
  return Response.json(STORIES);
}
