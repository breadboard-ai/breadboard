/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";
import read from "@read";
import write from "@write";

export { invoke as default, describe };

const { invoke, describe } = createConfigurator({
  title: "Configure Local Memory",
  initialize: async (inputs) => {
    const writing = await write({
      path: `/local/folio/${inputs.id}`,
      data: [{ parts: [{ text: "" }] }],
    });
    if (!ok(writing)) return writing;
    return { title: "Untitled Local Memory", configuration: {} };
  },
  read: async (inputs) => {
    const reading = await read({ path: `/local/folio/${inputs.id}` });
    const data = ok(reading) ? reading.data : [];
    return {
      schema: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { type: "object", behavior: ["llm-content"] },
          },
        },
      },
      values: { data },
    };
  },
  write: async (inputs) => {
    const data = inputs.values.data;
    if (!data) {
      return err(`No data to write`);
    }
    const writing = await write({
      path: `/local/folio/${inputs.id}`,
      data,
    });
    console.log("WRITING", inputs);
    if (!ok(writing)) return writing;
    return inputs.values;
  },
  preview: async ({ id }) => {
    const reading = await read({ path: `/local/folio/${id}` });
    const data = (ok(reading) ? reading.data : []) || [];
    return data;
  },
});
