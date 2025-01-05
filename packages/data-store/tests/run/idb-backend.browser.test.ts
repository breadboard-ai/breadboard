/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from "@esm-bundle/chai";
import { Files, IDBBackend } from "../../src/file-system/idb-backend.js";
import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";
import {
  createEphemeralBlobStore,
  FileSystemQueryResult,
  Outcome,
} from "@google-labs/breadboard";
import { DBSchema, deleteDB, openDB } from "idb";

const url = "http://www.example.com";

function bad<T>(o: Outcome<T>) {
  expect(
    o && typeof o === "object" && "$error" in o,
    "outcome must be an error"
  ).to.be.ok;
}

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o && o.$error;
  expect(!error, error as string).to.be.ok;
  return !error;
}

function justPaths(q: FileSystemQueryResult) {
  return good(q) && q.entries.map((entry) => entry.path);
}

function makeCx(...items: string[]): LLMContent[] {
  return items.map((text) => ({ parts: [{ text }] }));
}

function inline(data: string): InlineDataCapabilityPart {
  return { inlineData: { data, mimeType: "text/plain" } };
}

function makeDataCx(...items: string[][]): LLMContent[] {
  return items.map((part) => ({
    parts: part.map((data) => inline(data)),
  }));
}

function goodStoredData(contents: LLMContent[]) {
  const handles: string[] = [];
  for (const content of contents) {
    for (const part of content.parts) {
      if ("storedData" in part) {
        const { mimeType, handle } = part.storedData;
        expect(mimeType).eq("text/plain");
        expect(handle.startsWith("blob:"), "Must start with 'blob:'").true;
        handles.push(handle);
      }
    }
  }
  return handles;
}

type InspectableDB<T extends DBSchema> = {
  [K in keyof T]: T[K]["value"][];
};

async function inspect(): Promise<InspectableDB<Files>> {
  const db = await openDB<Files>("files", 1);

  const files = await db.getAll("files");
  const refs = await db.getAll("refs");
  const blobs = await db.getAll("blobs");

  db.close();

  return { files, refs, blobs };
}

describe("IDB Backend", () => {
  let backend: IDBBackend | null = null;

  beforeEach(async () => {
    if (backend) {
      await backend.close();
    }
    backend = null;
    await deleteDB("files");
  });

  it("supports read/append/query", async () => {
    backend = new IDBBackend(createEphemeralBlobStore());
    const appending = await backend.append(url, "/local/foo", makeCx("foo"));
    good(appending);

    const reading = await backend.read(url, "/local/foo", false);
    good(reading) && expect(reading).to.deep.equal(makeCx("foo"));

    const appendingMore = await backend.append(
      url,
      "/local/foo",
      makeCx("more")
    );
    good(appendingMore);

    const readingMore = await backend.read(url, "/local/foo", false);
    good(readingMore) &&
      expect(readingMore).to.deep.equal(makeCx("foo", "more"));

    const writingBar = await backend.append(url, "/local/bar", makeCx("bar"));
    good(writingBar);

    const readingBar = await backend.read(url, "/local/bar", false);
    good(readingBar) && expect(readingBar).to.deep.equal(makeCx("bar"));

    const querying = await backend.query(url, "/local/");
    good(querying) &&
      expect(justPaths(querying)).to.deep.equal(["/local/bar", "/local/foo"]);
  });

  it("supports overwriting", async () => {
    backend = new IDBBackend(createEphemeralBlobStore());

    const writingBar = await backend.write(url, "/local/bar", makeCx("bar"));
    good(writingBar);

    const readingBar = await backend.read(url, "/local/bar", false);
    good(readingBar) && expect(readingBar).to.deep.equal(makeCx("bar"));

    const writingBar2 = await backend.write(url, "/local/bar", makeCx("bar2"));
    good(writingBar2);

    const readingBar2 = await backend.read(url, "/local/bar", false);
    good(readingBar2) && expect(readingBar2).to.deep.equal(makeCx("bar2"));
  });

  it("handles not found error", async () => {
    backend = new IDBBackend(createEphemeralBlobStore());
    bad(await backend.read(url, "/local/foo", false));
  });

  it("supports copy", async () => {
    backend = new IDBBackend(createEphemeralBlobStore());

    const writingFoo = await backend.append(url, "/local/foo", makeCx("foo"));
    good(writingFoo);

    const copying = await backend.copy(url, "/local/foo", "/local/bar/test");
    good(copying);

    const querying = await backend.query(url, "/local/");
    good(querying) &&
      expect(justPaths(querying)).to.deep.equal([
        "/local/bar/test",
        "/local/foo",
      ]);

    const readingBar = await backend.read(url, "/local/bar/test", false);
    good(readingBar) && expect(readingBar).to.deep.equal(makeCx("foo"));
  });

  it("supports delete", async () => {
    backend = new IDBBackend(createEphemeralBlobStore());

    const writingFoo = await backend.append(url, "/local/foo", makeCx("foo"));
    good(writingFoo);

    const copying = await backend.copy(url, "/local/foo", "/local/bar/test");
    good(copying);

    const copying2 = await backend.copy(url, "/local/foo", "/local/foo2");
    good(copying2);

    const writingBaz = await backend.append(url, "/local/baz", makeCx("baz"));
    good(writingBaz);

    const beforeDelete = await backend.query(url, "/local/");
    good(beforeDelete) &&
      expect(justPaths(beforeDelete)).to.deep.equal([
        "/local/bar/test",
        "/local/baz",
        "/local/foo",
        "/local/foo2",
      ]);

    const deletingFoo = await backend.delete(url, "/local/foo", false);
    good(deletingFoo);

    const afterDeletingFoo = await backend.query(url, "/local/");
    good(afterDeletingFoo) &&
      expect(justPaths(afterDeletingFoo)).to.deep.equal([
        "/local/bar/test",
        "/local/baz",
        "/local/foo2",
      ]);

    const deletingAll = await backend.delete(url, "/local/", true);
    good(deletingAll);

    const afterDeletingAll = await backend.query(url, "/local/");
    good(afterDeletingAll) &&
      expect(justPaths(afterDeletingAll)).to.deep.equal([]);
  });

  it("supports multiple URLs", async () => {
    const url2 = "https://example.com/foo";
    const backend1 = new IDBBackend(createEphemeralBlobStore());
    const backend2 = new IDBBackend(createEphemeralBlobStore());
    const backend3 = new IDBBackend(createEphemeralBlobStore());

    const writingFoo = await backend1.append(url, "/local/foo", makeCx("foo"));
    good(writingFoo);

    const writingBaz = await backend2.append(url2, "/local/baz", makeCx("baz"));
    good(writingBaz);

    const querying1 = await backend1.query(url, "/local/");
    good(querying1) &&
      expect(justPaths(querying1)).to.deep.equal(["/local/foo"]);

    const querying2 = await backend2.query(url2, "/local/");
    good(querying2) &&
      expect(justPaths(querying2)).to.deep.equal(["/local/baz"]);

    const querying3 = await backend3.query(url, "/local/");
    good(querying3) &&
      expect(justPaths(querying3)).to.deep.equal(["/local/foo"]);
    await backend1.close();
    await backend2.close();
    await backend3.close();
  });

  it("supports blob write/append/read", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);

    const writingFoo = await backend.write(
      url,
      "/local/foo",
      makeDataCx(["foo"])
    );
    good(writingFoo);

    expect(blobs.size).equal(1);

    const appendingFoo = await backend.append(
      url,
      "/local/foo",
      makeDataCx(["bar"])
    );
    good(appendingFoo);

    expect(blobs.size).equal(2);

    const readingFoo = await backend.read(url, "/local/foo", false);
    good(readingFoo) && goodStoredData(readingFoo);
  });

  it("supports inflating blobs on read", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);
    const foo = makeDataCx(["foo"]);

    const writingFoo = await backend.write(url, "/local/foo", foo);
    good(writingFoo);

    const readingFoo = await backend.read(url, "/local/foo", true);
    good(readingFoo) && expect(readingFoo).deep.eq(foo);
  });

  it("correctly deletes blobs", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);

    const writingFoo = await backend.write(
      url,
      "/local/test/foo",
      makeDataCx(["foo"])
    );
    good(writingFoo);

    const writingBar = await backend.write(
      url,
      "/local/test/bar",
      makeDataCx(["bar"])
    );
    good(writingBar);

    const writingBaz = await backend.write(
      url,
      "/local/baz",
      makeDataCx(["baz"])
    );
    good(writingBaz);

    const writingQux = await backend.write(
      url,
      "/local/qux",
      makeDataCx(["qux"])
    );
    good(writingQux);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(4);
      expect(db.refs.length).eq(4);
      expect(db.files.length).eq(4);
    }

    const deletingFooBar = await backend.delete(url, "/local/test/", true);
    good(deletingFooBar);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(2);
      expect(db.refs.length).eq(2);
      expect(db.files.length).eq(2);
    }

    const deletingBaz = await backend.delete(url, "/local/baz", false);
    good(deletingBaz);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(1);
      expect(db.refs.length).eq(1);
      expect(db.files.length).eq(1);
    }
  });

  it("correctly copies blob refs", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);

    const writingFoo = await backend.write(
      url,
      "/local/test/foo",
      makeDataCx(["foo"])
    );
    good(writingFoo);

    const copyingFoo = await backend.copy(
      url,
      "/local/test/foo",
      "/local/test/bar"
    );
    good(copyingFoo);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(1);
      expect(db.refs.length).eq(2);
      expect(db.files.length).eq(2);
    }

    const deletingBar = await backend.delete(url, "/local/test/bar", false);
    good(deletingBar);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(1);
      expect(db.refs.length).eq(1);
      expect(db.files.length).eq(1);
    }

    const deletingFoo = await backend.delete(url, "/local/test/foo", false);
    good(deletingFoo);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(0);
      expect(db.refs.length).eq(0);
      expect(db.files.length).eq(0);
    }
  });

  it("correctly moves blob refs", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);

    const writingFoo = await backend.write(
      url,
      "/local/test/foo",
      makeDataCx(["foo"])
    );
    good(writingFoo);

    const copyingFoo = await backend.move(
      url,
      "/local/test/foo",
      "/local/test/bar"
    );
    good(copyingFoo);
    {
      const db = await inspect();
      expect(db.blobs.length).eq(1);
      expect(db.refs.length).eq(1);
      expect(db.files.length).eq(1);
    }

    const readingFoo = await backend.read(url, "/local/test/foo", false);
    bad(readingFoo);
  });

  it("keeps ephemeral blob URLs consistent", async () => {
    const blobs = createEphemeralBlobStore();
    backend = new IDBBackend(blobs);

    const writingFoo = await backend.write(
      url,
      "/local/foo",
      makeDataCx(["foo"])
    );
    good(writingFoo);

    const readingFoo = await backend.read(url, "/local/foo", false);
    if (good(readingFoo)) {
      const handles = goodStoredData(readingFoo);
      const readingFooAgain = await backend.read(url, "/local/foo", false);
      if (good(readingFooAgain)) {
        const handlesAgain = goodStoredData(readingFooAgain);
        expect(handles).deep.eq(handlesAgain);
      }
    }
  });
});
