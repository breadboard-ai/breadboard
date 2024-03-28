import { Schema } from "@google-labs/breadboard";

export function objectToSchema(obj: unknown): Schema {
  if (obj === undefined) {
    // Handle undefined
    return {};
  } else if (obj === null) {
    // Handle null
    return { type: "null" };
  } else if (Array.isArray(obj)) {
    // Handle arrays
    const items: Schema[] = obj.map(objectToSchema);

    // Determine if all items in the array are of the same type
    const allItemsSameType = items.every(
      (item, _, [first]) => JSON.stringify(item) === JSON.stringify(first)
    );

    if (items.length > 0) {
      // If all items are of the same type, use the first item's schema for all.
      // Otherwise, set a generic items schema indicating a non-uniform array.
      if (allItemsSameType) {
        return { type: "array", items: items[0] };
      } else {
        return { type: "array" };
      }
    }
    // Return a schema for an empty array if there are no items.
    return { type: "array" };
  } else if (typeof obj === "object" && obj !== null) {
    // Handle objects
    const properties: { [key: string]: Schema } = {};
    for (const key of Object.keys(obj)) {
      properties[key] = objectToSchema(
        (obj as { [key: string]: unknown })[key]
      );
    }
    return { type: "object", properties };
  } else {
    // Handle primitives
    return { type: typeof obj };
  }
}
