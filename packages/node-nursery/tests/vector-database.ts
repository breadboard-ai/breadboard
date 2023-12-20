/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  VectorDocument,
  MemoryVectorDatabase,
} from "../src/vector-database.js";

import create_vector_database from "../src/nodes/create-vector-database.js";
import add_to_vector_database from "../src//nodes/add-to-vector-database.js";
import query_vector_database from "../src//nodes/query-vector-database.js";

const exampleDocs: VectorDocument[] = [
  {
    id: "1",
    kind: "VectorDocument",
    embedding: [1, 0, 0],
  },
  {
    id: "2",
    kind: "VectorDocument",
    embedding: [0, 1, 0],
  },
];

test("memory-vector-database", async (t) => {
  const db = new MemoryVectorDatabase();
  await db.add(exampleDocs);

  const result1 = await db.findNearest([Math.sqrt(2), Math.sqrt(2), 0]);
  t.is(result1[0].document.id, "1");
  t.is(result1[1].document.id, "2");
  t.is(result1[0].similarity.toFixed(6), (1 / Math.sqrt(2)).toFixed(6));
  t.is(result1.length, 2);

  const result2 = await db.findNearest([0, Math.sqrt(2), Math.sqrt(2)], 1);
  t.is(result2[0].document.id, "2");
  t.is(result2.length, 1);
});

test("vector-database nodes", async (t) => {
  const { db } = (await create_vector_database({ type: "memory" })) as {
    db: MemoryVectorDatabase;
  };
  t.true(db instanceof MemoryVectorDatabase);

  const { db: db2 } = (await add_to_vector_database({
    db,
    documents: exampleDocs,
  })) as { db: MemoryVectorDatabase };
  t.is(db2, db);

  const { results } = (await query_vector_database({
    db,
    embedding: [Math.sqrt(2), Math.sqrt(2), 0],
  })) as { results: { document: VectorDocument }[] };
  t.is(results[0].document.id, "1");
  t.is(results[1].document.id, "2");
  t.is(results.length, 2);

  const { results: results2 } = (await query_vector_database({
    db,
    embedding: [0, Math.sqrt(2), Math.sqrt(2)],
    topK: 1,
  })) as { results: { document: VectorDocument }[] };
  t.is(results2[0].document.id, "2");
  t.is(results2.length, 1);
});
