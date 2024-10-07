/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImageParams } from "@/app/types";
import { getImage } from "@/app/utils/store";

export async function GET(_req: Request, { params }: ImageParams) {
  const { image } = params;
  if (image) {
    const buffer = await getImage(image);
    if (buffer) {
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
        },
      });
    }
  }
  return new Response("Image not found", { status: 404 });
}
