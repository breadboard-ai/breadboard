/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useRouter } from "next/navigation";

export default function Form() {
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      console.log("submit");
      router.push("/about");
    } catch (error) {
      console.error(error);
    }
    // const result = await fetch("/api/create", {
    //   method: "POST",
    //   body: new FormData(event.currentTarget),
    // });
    // console.log(await result.text());
  }
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="topic">Topic:</label>
      <textarea id="topic" name="topic"></textarea>
      <button
        className="block bg-slate-500 rounded-full py-2 px-8 text-white mt-3"
        type="submit"
      >
        Create
      </button>
    </form>
  );
}
