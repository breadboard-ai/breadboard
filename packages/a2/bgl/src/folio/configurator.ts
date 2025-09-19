/**
 * @fileoverview Add a description for your module here.
 */

import { createConfigurator } from "../a2/connector-manager";
import { err, ok } from "../a2/utils";

export { invoke as default, describe };

const { invoke, describe } = createConfigurator({
  title: "Configure Local Memory",
  initialize: async (caps, inputs) => {
    const writing = await caps.write({
      path: `/local/folio/${inputs.id}`,
      data: [{ parts: [{ text: "" }] }],
    });
    if (!ok(writing)) return writing;
    return { title: "Untitled Local Memory", configuration: {} };
  },
  read: async (caps, inputs) => {
    const reading = await caps.read({ path: `/local/folio/${inputs.id}` });
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
  write: async (caps, inputs) => {
    const data = inputs.values.data;
    if (!data) {
      return err(`No data to write`);
    }
    const writing = await caps.write({
      path: `/local/folio/${inputs.id}`,
      data,
    });
    console.log("WRITING", inputs);
    if (!ok(writing)) return writing;
    return inputs.values;
  },
  preview: async (caps, { id }) => {
    const reading = await caps.read({ path: `/local/folio/${id}` });
    const data = (ok(reading) ? reading.data : []) || [];
    return data;
  },
});
