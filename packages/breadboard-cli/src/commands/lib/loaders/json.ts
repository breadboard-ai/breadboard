import { Board, BoardRunner } from "@google-labs/breadboard";
import { Loader, Options } from "../loader.js";
import { pathToFileURL } from "url";
import { relative } from "path";

export class JSONLoader extends Loader {
  async load(filePath: string, options: Options): Promise<BoardRunner> {
    const pathRelativeToBase = relative(options.base, filePath);
    const board = await Board.load(pathRelativeToBase, {
      base: new URL(pathToFileURL(options.base + "/")),
    });

    return board;
  }
}
