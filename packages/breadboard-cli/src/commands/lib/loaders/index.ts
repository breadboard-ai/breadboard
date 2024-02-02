import { BoardRunner } from "@google-labs/breadboard";
import { JSLoader } from "./javascript.js";
import { Loader, Options } from "../loader.js";
import { TypeScriptLoader } from "./typescript.js";
import { JSONLoader } from "./json.js";

const supportedFileTypes = ["js", "ts", "json"] as const;
type LoaderTuple = typeof supportedFileTypes;
type LoaderType = LoaderTuple[number];

export class Loaders {
  #loaderInstance: any;

  static get supportedFileTypes(): LoaderTuple {
    return supportedFileTypes;
  }

  constructor(loader: LoaderType) {
    if (loader === "js") {
      this.#loaderInstance = new JSLoader();
    } else if (loader === "ts") {
      this.#loaderInstance = new TypeScriptLoader();
    } else if (loader === "json") {
      this.#loaderInstance = new JSONLoader();
    } else {
      throw new Error(`Unsupported file type ${loader}`);
    }
  }

  async load(filePath: string, options: Options): Promise<BoardRunner> {
    return this.#loaderInstance.load(filePath, options);
  }
}

export { Loader };
