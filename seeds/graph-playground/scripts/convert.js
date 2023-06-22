// a script to convert from one version of format to another

import { readFile, writeFile } from "fs/promises";

// eslint-disable-next-line no-undef
const name = process.argv[2];

const before = JSON.parse(await readFile(name, "utf-8"));

const after = {
  edges: before.edges.map(({ from, to, optional, entry }) => ({
    from: from.node,
    out: from.output,
    to: to.node,
    in: to.input,
    optional,
    entry,
  })),
  nodes: before.nodes,
};

await writeFile(name, JSON.stringify(after, null, 2));
