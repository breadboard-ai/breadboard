import { NodeValue, Schema } from "@google-labs/breadboard";

export function objectToSchema(obj: unknown): Schema {
  if (obj === undefined) {
    // Handle undefined
    return {};
  } else if (obj === null) {
    // Handle null
    return { type: "null" };
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
    // Handle primitives
    return { type: typeof obj };
  }
}
