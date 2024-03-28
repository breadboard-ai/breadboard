import { NodeValue, Schema } from "@google-labs/breadboard";

export function objectToSchema(obj: NodeValue): Schema {
  if (obj === undefined) {
    // Handle undefined
    return { type: "undefined" };
  } else if (Array.isArray(obj)) {
    // Handle arrays
    const items = obj.length > 0 ? objectToSchema(obj[0]) : {};
    return { type: "array", items };
  } else if (typeof obj === "object" && obj !== null) {
    // Handle objects
    const properties: { [key: string]: Schema } = {};
    for (const key of Object.keys(obj)) {
      // @ts-expect-error obj[key] is a NodeValue, not a Schema
      properties[key] = objectToSchema(obj[key]);
    }
    return { type: "object", properties };
  } else {
    // Handle primitives (string, number, boolean, null)
    return { type: typeof obj };
  }
}
