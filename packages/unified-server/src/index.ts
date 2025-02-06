/*
 * Re-export module for the visual editor.
 *
 * The unified server's client-side entry point is an index.html file that is
 * copied from the visual editor during the build process. (See copy-assets in
 * the scripts directory for exact behavior.)
 *
 * The inline module in the HTML contains the following line:
 *
 *   const { Main } = await import("./src/index.ts");
 *
 * This module re-exports the contents of Visual Editor's index.ts so that it
 * is discoverable by the Unified Server's entry point.
 *
 * Note that this module must exist in this location (src/index.ts) to be
 * discoverable by the copied index.html.
 */

export * from "@breadboard-ai/visual-editor";
