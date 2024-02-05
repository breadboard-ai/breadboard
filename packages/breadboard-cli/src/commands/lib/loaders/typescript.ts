import { Board, BoardRunner } from "@google-labs/breadboard";
import esbuild from "esbuild";
import { readFile, stat, unlink, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { Loader, Options } from "../loader.js";

export class TypeScriptLoader extends Loader {
  /* 
  If we are loading from Source (TS) then we need to compile it and output it to a place where there are unlikely to be any collisions.
*/
  async #loadBoardFromSource(
    filename: string,
    source: string,
    options?: Options
  ): Promise<Board | BoardRunner | undefined> {
    const tmpDir = options?.output ?? process.cwd();
    const randomName = Buffer.from(
      crypto.getRandomValues(new Uint32Array(16))
    ).toString("hex");
    const tmpFilePath = join(
      tmpDir,
      `~${basename(filename, "ts")}${randomName}tmp.mjs`
    );

    let tmpFileStat;
    try {
      tmpFileStat = await stat(tmpFilePath);
    } catch (e) {
      // Don't care if the file doesn't exist. It's fine. It's what we want.
      ("Nothing to see here. Just don't want to have to re-throw.");
    }

    if (tmpFileStat && tmpFileStat.isFile()) {
      // Don't write to a file.
      throw new Error(
        `The temporary file ${tmpFilePath} already exists. We can't write to it.`
      );
    }

    if (tmpFileStat && tmpFileStat.isSymbolicLink()) {
      // Don't write to a symbolic link.
      throw new Error(
        `The file ${tmpFilePath} is a symbolic link. We can't write to it.`
      );
    }

    if (tmpFileStat && tmpFileStat.isDirectory() == false) {
      // Don't write to a directory.
      throw new Error(
        `The file ${tmpFilePath} is a directory. We can't write to it.`
      );
    }

    try {
      // I heard it might be possible to do a symlink hijack. double check.
      await writeFile(tmpFilePath, source);

      // For the import to work it has to be relative to the current working directory.
      const board = await this.loadBoardFromModule(
        resolve(process.cwd(), tmpFilePath)
      );

      return board;
    } catch (e) {
      console.error(e);
      return undefined;
    } finally {
      // remove the file
      if (tmpFileStat && tmpFileStat.isFile()) {
        await unlink(tmpFilePath);
      }
    }
  }

  async #makeFromSource(
    filename: string,
    source: string,
    options?: Options
  ): Promise<{ boardJson: string; board: BoardRunner }> {
    const board = await this.#loadBoardFromSource(filename, source, options);
    if (board == undefined) {
      throw new Error("Failed to load board from source");
    }
    const boardJson = JSON.stringify(board, null, 2);
    return { boardJson, board };
  }

  async load(filePath: string, options: Options): Promise<BoardRunner> {
    const fileContents = await readFile(filePath, "utf-8");
    const result = await esbuild.transform(fileContents, { loader: "ts" });
    const { board } = await this.#makeFromSource(
      filePath,
      result.code,
      options
    );

    return board;
  }
}
