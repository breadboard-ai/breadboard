import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Query the XKCD API via an Open API Spec board",
  description: "Query's the XCD API.",
  version: "0.0.3",
};

export default await board(() => {
  const input = base.input({ $id: "input" });

  const apiBoard = core.invoke({
    $id: "xkcdInvoke",
    path: "../index.json",
    url: input.url,
  });

  return core.invoke({}).in({ board: apiBoard.getInfo0json });
}).serialize(metaData);
