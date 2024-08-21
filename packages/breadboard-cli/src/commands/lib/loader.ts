import { SerializableBoard, serialize } from "@breadboard-ai/build";
import { GraphDescriptor } from "@google-labs/breadboard";
import { pathToFileURL } from "url";

export type Options = {
  output: string;
  root?: string;
  watch?: boolean;
  save?: boolean;
};

const boardLike = (
  board: Record<string, unknown>
): board is GraphDescriptor => {
  return board && "edges" in board && "nodes" in board;
};

export abstract class Loader {
  async loadBoardFromModule(file: string) {
    // This will leak. Look for other hot reloading solutions.
    let board = (await import(`${file}?${Date.now()}`)).default;

    if (board == undefined)
      throw new Error(`Board ${file} does not have a default export`);

    if ("inputs" in board && "outputs" in board) {
      // TODO(aomarks) Not a great way to detect build boards.
      board = serialize(board as SerializableBoard);
    }

    if (boardLike(board)) {
      // A graph descriptor has been exported.. Possibly a lambda.
      board.url = pathToFileURL(file).href; // So that the base url is correct for subsequent invokes
    }
    return board;
  }

  abstract load(
    filePath: string,
    options: Options
  ): Promise<GraphDescriptor | null>;
}
