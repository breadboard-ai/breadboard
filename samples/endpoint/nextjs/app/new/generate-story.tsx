/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useEffect, useState } from "react";
import Form from "./form";
import { StoryListType, StoryMakingProgress, StoryMakingState } from "../types";
import { chunkRepairTransform } from "./chunk-repair";
import Link from "next/link";
import { rememberStory } from "../utils/local-store";
import { serverStreamEventDecoder } from "../utils/stream";

export default function GenerateStory() {
  const [state, setState] = useState<StoryMakingState>("idle");
  const [progress, setProgress] = useState<StoryMakingProgress[]>([]);
  const [form, setForm] = useState<FormData | null>(null);

  useEffect(() => {
    async function startFetching() {
      const storyItem: StoryListType = {
        id: "",
        title: "",
        img: "",
      };
      try {
        const result = await fetch("/api/create", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(form!.entries())),
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!result.ok) {
          setProgress((progress) => [
            ...progress,
            { type: "error", error: `${result.status} ${result.statusText}` },
          ]);
        }
        result.body
          ?.pipeThrough(new TextDecoderStream())
          .pipeThrough(chunkRepairTransform())
          .pipeThrough(serverStreamEventDecoder())
          .pipeTo(
            new WritableStream({
              write(chunk) {
                const json = JSON.parse(chunk) as StoryMakingProgress;
                if (json.type === "done") {
                  storyItem.id = json.id;
                } else if (json.type === "chapter") {
                  storyItem.img = json.chapter.img;
                } else if (json.type === "start") {
                  storyItem.title = json.title;
                } else if (json.type === "rejected") {
                  setState("error");
                }
                setProgress((progress) => [...progress, json]);
              },
              close() {
                setState("done");
                if (storyItem.id) {
                  rememberStory(storyItem);
                }
              },
            })
          );
      } catch (error) {
        // TODO: Handle error
        console.error(error);
        setState("error");
      }
    }
    if (state == "starting" && form) {
      setState("creating");
      startFetching();
    }
  }, [state, form]);

  if (state !== "idle") {
    return (
      <section className="grid grid-cols-6 gap-5">
        {state === "creating" && (
          <h2 className="col-span-6 animate-bounce">Writing chapters...</h2>
        )}
        {progress.map((event, i) => {
          switch (event.type) {
            case "rejected":
              return (
                <h2 key={i} className="col-span-6 text-red-500">
                  {event.message}
                </h2>
              );
            case "error":
              return (
                <h2 key={i} className="col-span-6 text-red-500">
                  Error: {event.error}
                </h2>
              );
            case "start":
              return (
                <h2 key={i} className="col-span-6">
                  {event.title}
                </h2>
              );
            case "chapter":
              return (
                <div key={i}>
                  <img
                    className="block rounded-full bg-gradient-to-r from-slate-100 to-slate-200"
                    width="100"
                    height="100"
                    src={`/api/image/${event.chapter.img}`}
                    alt={event.chapter.text}
                  />
                </div>
              );
            case "done":
              return (
                <div key={i} className="col-span-6">
                  <h2>Story Created</h2>
                  <Link
                    href={`/story/${event.id}`}
                    className="inline-block mt-5 py-2 px-4 border-2 rounded-full hover:bg-fuchsia-100"
                  >
                    Read Story
                  </Link>
                </div>
              );
          }
        })}
        {state === "creating" && (
          <div
            style={{ width: "100px", height: "100px" }}
            className="block rounded-full bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse"
          ></div>
        )}
      </section>
    );
  }

  return (
    <>
      <h2 className="font-bold">Ask The Story Teller for a New Story</h2>
      <p className="pt-5 text-slate-400">
        Enter the topic around which to build the story. It can be short like
        "the old clock" or long. The Story Teller will use it as inspiration.
      </p>
      <Form
        onSubmit={(data: FormData) => {
          setState("starting");
          setForm(data);
        }}
      ></Form>
    </>
  );
}
