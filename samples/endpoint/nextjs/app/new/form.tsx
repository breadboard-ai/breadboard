/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Form() {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("submit");
    setCreating(true);
    const result = await fetch("/api/create", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    console.log(await result.text());
    setCreating(false);
  }
  return creating ? (
    <div>Creating...</div>
  ) : (
    <form onSubmit={onSubmit}>
      <div className="flex pt-5 gap-3">
        <label htmlFor="topic">Topic:</label>
        <textarea
          required
          name="topic"
          className="flex-1 border-2 rounded-xl"
        ></textarea>
      </div>
      <button
        className="hover:bg-fuchsia-100 block mt-5 py-2 px-4 border-2 rounded-full"
        type="submit"
      >
        Start
      </button>
    </form>
  );
}
