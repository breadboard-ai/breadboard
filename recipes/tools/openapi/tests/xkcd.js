import { base, recipe, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Query the XKCD API via an Open API Spec board",
  description: "Query's the XCD API.",
  version: "0.0.3",
};

const inputSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      title: "XKCD API URL",
      default: "https://xkcd.com/614",
    },
  },
};

export default await recipe(() => {
  const input = base.input({
    $id: "input",
    schema: inputSchema
});

  const apiBoard = core.invoke({
    $id: "xkcdInvoke",
    path: "../index.json",
    url: input.url,
  });

  return core.invoke({}).in({ board: apiBoard.getInfo0json });
}).serialize(metaData);
