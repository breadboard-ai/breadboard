/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chapter, StoryMakingProgress, StoryType } from "@/app/types";
import { generateStory, toText } from "@/app/utils/breadboard";
import { storeImage, storeStory } from "@/app/utils/store";
import { RunEvent } from "@/app/utils/types";

export async function POST(req: Request) {
  let topic;
  try {
    const json = await req.json();
    topic = json.topic;
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!topic) {
    return new Response("Missing topic", { status: 400 });
  }
  const story: StoryType = {
    id: "",
    title: topic,
    topic,
    chapters: [],
  };
  let hasErrors = false;

  const stream = (await generateStory(topic))
    .pipeThrough(
      new TransformStream<RunEvent, StoryMakingProgress>({
        async transform(chunk, controller) {
          const [type, data] = chunk;
          switch (type) {
            case "input":
              controller.enqueue({
                type: "error",
                error: "Unexpected input event",
              });
              hasErrors = true;
              break;
            case "output": {
              const { outputs } = data;
              if ("reject" in outputs) {
                controller.enqueue({
                  type: "rejected",
                  message: toText(
                    outputs.reject,
                    "This topic is not appropriate for a children's story"
                  ),
                });
                hasErrors = true;
              } else if ("title" in outputs) {
                story.title = toText(outputs.title, topic);
                controller.enqueue({
                  type: "start",
                  title: story.title,
                });
              } else if ("chapter" in outputs) {
                const [image, text] = outputs.chapter.at(-1)?.parts || [];
                if (
                  !image ||
                  !text ||
                  !("inlineData" in image) ||
                  !("text" in text)
                ) {
                  controller.enqueue({
                    type: "error",
                    error: "Missing image or text in chapter",
                  });
                  hasErrors = true;
                } else {
                  // Store image in the store
                  const img = await storeImage(
                    Buffer.from(image.inlineData.data, "base64")
                  );
                  const chapter: Chapter = {
                    img,
                    text: text.text,
                  };
                  story.chapters.push(chapter);
                  controller.enqueue({
                    type: "chapter",
                    chapter,
                  });
                }
              }
              break;
            }
            case "error": {
              controller.enqueue({
                type: "error",
                error: data,
              });
              hasErrors = true;
              break;
            }
          }
        },
        async flush(controller) {
          if (hasErrors) {
            return;
          }
          const id = await storeStory(story);
          controller.enqueue({ type: "done", id });
        },
      })
    )
    .pipeThrough(serverSentEventTransform())
    .pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

function toServerSentEvent(event: StoryMakingProgress) {
  return `event: ${event.type}\n\ndata: ${JSON.stringify(event)}\n\n`;
}

function serverSentEventTransform() {
  return new TransformStream<StoryMakingProgress, string>({
    transform(chunk, controller) {
      controller.enqueue(toServerSentEvent(chunk));
    },
  });
}
