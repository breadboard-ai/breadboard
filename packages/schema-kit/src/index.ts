import { KitBuilder } from "@google-labs/breadboard/kits";
import { version } from "../package.json" assert { type: "json" };
import * as nodes from "./nodes/index.js";
export { nodes };

export const SchemaKit = KitBuilder.wrap(
  {
    url: "npm:@google-labs/schema-kit",
    title: "Schema Kit",
    description: "A kit for working with JSON Schema.",
    version: version,
  },
  {
    objectToSchema: ({ object }: { object: unknown }) => ({
      schema: nodes.objectToSchema(object),
    }),
  }
);
export default SchemaKit;
