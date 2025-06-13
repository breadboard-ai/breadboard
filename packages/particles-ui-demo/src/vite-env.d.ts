declare module "*.md";

declare module "*?raw" {
  const content: string;
  export default content;
}
