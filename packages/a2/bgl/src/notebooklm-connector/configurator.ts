/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";
import { executeTool } from "./a2/step-executor";
import type { Configuration } from "./types";

import read from "@read";
import write from "@write";

export { invoke as default, describe };

const { invoke, describe } = createConfigurator<Configuration, Configuration>({
  title: "NotebookLM",
  initialize: async () => {
    return {
      title: "Untitled NotebookLM",
      configuration: {},
    };
  },
  read: async ({ id, configuration }) => {
    const readingNotebooks = await executeTool("notebooklm_list_projects", {});
    if (!ok(readingNotebooks)) return readingNotebooks;
    console.log("READING NOTEBOOKS", readingNotebooks);
    return {
      schema: {
        type: "object",
        properties: {
          notebookId: {
            type: "string",
            title: "Notebook",
            description: "The notebook to query",
          },
        },
      },
      values: configuration,
    };
  },
});
