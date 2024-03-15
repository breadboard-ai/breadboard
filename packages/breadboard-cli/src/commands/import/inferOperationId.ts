/*
    If there is no operation ID, we need to generate one from the path, but format it like a JS function name.
   */

export const inferOperationId = (path: string, method: string) => {
  const newName = path
    .split("/")
    .map((part) =>
      part.length == 0 ? part : part[0].toUpperCase() + part.slice(1)
    )
    .join("")
    .replace(/[.-]/g, "") // Remove dashes and dots
    .replace(/[{}]/g, ""); // Remove curly braces (need to improve this)

  return `${method}${newName}`;
};
