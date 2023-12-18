import { Board, BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import { readFile, stat, unlink, writeFile } from "fs/promises";
import path, { basename, join } from "path";

export type Options = {
  output?: string;
  watch?: boolean;
};

const boardLike = (
  board: Record<string, unknown>
): board is GraphDescriptor => {
  return board && "edges" in board && "nodes" in board;
};

export abstract class Loader {
  async makeFromSource(filename: string, source: string, options?: Options) {
    const board = await this.loadBoardFromSource(filename, source, options);
    const boardJson = JSON.stringify(board, null, 2);
    return { boardJson, board };
  }

  async makeFromFile(filePath: string) {
    const board = await this.loadBoardFromModule(
      path.resolve(process.cwd(), filePath)
    );
    const boardJson = JSON.stringify(board, null, 2);
    return { boardJson, board };
  }

  async loadBoardFromModule(file: string) {
    // This will leak. Look for other hot reloading solutions.
    let board = (await import(`${file}?${Date.now()}`)).default;

    if (board == undefined)
      throw new Error(`Board ${file} does not have a default export`);

    if (boardLike(board)) {
      // A graph descriptor has been exported.. Possibly a lambda.
      board = await Board.fromGraphDescriptor(board);
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

  /* 
  If we are loading from Source (TS) then we need to compile it and output it to a place where there are unlikely to be any collisions.
*/
  async loadBoardFromSource(
    filename: string,
    source: string,
    options?: Options
  ) {
    const tmpDir = options?.output ?? process.cwd();
    const filePath = join(tmpDir, `~${basename(filename, "ts")}tmp.mjs`);

    let tmpFileStat;
    try {
      tmpFileStat = await stat(filePath);
    } catch (e) {
      // Don't care if the file doesn't exist. It's fine. It's what we want.
      ("Nothing to see here. Just don't want to have to re-throw.");
    }

    if (tmpFileStat && tmpFileStat.isFile()) {
      // Don't write to a file.
      throw new Error(
        `The temporary file ${filePath} already exists. We can't write to it.`
      );
    }

    if (tmpFileStat && tmpFileStat.isSymbolicLink()) {
      // Don't write to a symbolic link.
      throw new Error(
        `The file ${filePath} is a symbolic link. We can't write to it.`
      );
    }

    // I heard it might be possible to do a symlink hijack. double check.
    await writeFile(filePath, source);

    // For the import to work it has to be relative to the current working directory.
    const board = await this.loadBoardFromModule(
      path.resolve(process.cwd(), filePath)
    );

    // remove the file
    await unlink(filePath);

    return board;
  }

  abstract load(filePath: string, options: Options): Promise<BoardRunner>;
}
