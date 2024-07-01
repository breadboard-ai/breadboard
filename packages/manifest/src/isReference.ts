import { ResourceReference } from ".";


export const isReference = (value: unknown): value is ResourceReference => {
  return (
    typeof value === "object" &&
    value !== null &&
    ("ref" in value || "reference" in value)
  );
};
