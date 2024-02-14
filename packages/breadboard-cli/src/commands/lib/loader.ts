import { Board, BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
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

    if (boardLike(board)) {
      // A graph descriptor has been exported.. Possibly a lambda.
      board = await Board.fromGraphDescriptor(board);
      board.url = pathToFileURL(file); // So that the base url is correct for subsequent invokes
    }
    if (
      board instanceof Board == false &&
      board instanceof BoardRunner == false
    )
      throw new Error(
        `Board ${file} does not have a default export of type Board, Lambda or something that looks like a board.`
      );

    return board;
  }

  abstract load(filePath: string, options: Options): Promise<BoardRunner>;
}
