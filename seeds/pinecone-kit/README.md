# A Breadboard Kit for Pinecone

This kit is a an early prototype, and is very likely to change. However, it should give pretty good idea on how to build kits with boards.

There are currently four boards that power this kit:

- [`pinecone-api-config`](src/boards/pinecone-api-config.ts), which handles configuration of the Pinecone API, and is represented by the `config` node.

- [`pinecone-api-vector`](src/boards/pinecone-api-vector.ts), which is a thin wrapper around the [vector operations](https://docs.pinecone.io/reference/vector-operations), and is represented by the `vector` node.

- [`pinecone-api-upsert`](src/boards/pinecone-api-upsert.ts), which uses the `pinecone-api-config` and `pinecone-api-vector` boards to call Pinecone [upsert API](https://docs.pinecone.io/reference/upsert), and is represented by the `upsert` node.

- [`pinecone-api-query`](src/boards/pinecone-api-query.ts), which uses the `pinecone-api-config` and `pinecone-api-vector` boards to call Pinecone [query API](https://docs.pinecone.io/reference/query), and is represented by the `query` node.

To load this kit into your board, run:

```bash
npm i @google-labs/pinecone-kit
```

Then, in your board, add the following:

```ts
import { Pinecone } from "@google-labs/pinecone-kit";

// Add the kit to some existing `board`.
const pinecone = board.addKit(Pinecone);

// This is the `query` node.
const query = pinecone.query();
```

The `config` and `vector` node can be used to call other vector operations.
