/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

export default function Form({
  onSubmit,
}: {
  onSubmit: (data: FormData) => void;
}) {
  async function internalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.target as HTMLFormElement));
  }

  return (
    <form onSubmit={internalSubmit}>
      <div className="flex pt-5 gap-3">
        <label className="pt-1" htmlFor="topic">
          Topic:
        </label>
        <textarea
          required
          name="topic"
          className="flex-1 border-2 rounded-xl px-2 py-1"
          defaultValue={"Amazing Grace"}
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
