# Breadboard Unified Server

> [!NOTE] The Breadboard Unified Server is currently under active development
> and is being tracked at
> [Issue #3913](https://github.com/breadboard-ai/breadboard/issues/3913)

The Breadboard Unified Server is a single client/server application that serves
the Visual Editor (as a static JS bundle), the Board Server, and the Connection
server from a single endpoint.

The Visual Editor will be configured to point back to its origin endpoint as a
board provider. This replaces the normal "add provider" functionality in Visual
Editor.

## Current Status (as of Jan 2025)

The server is packaged but not functional. The Connection Server endpoints work
mostly as expected, but the Visual Editor and Board Server do not. Also, the
build and deploy steps do not work completely. Some manual manipulation is
required to get them working.

## Project Structure

The Unified Server uses the
[Vite-Express](https://github.com/szymmis/vite-express) package to run a normal
ExpressJS server that falls back to client-side static content as a fallthrough
route.

https://github.com/szymmis/vite-express?tab=readme-ov-file#-how-does-it-work

The client-side content is served by the Vite Dev Server in dev mode, and is
served from the compiled `dist` directory in production mode.

The unified server itself aims to have a minimal amount of code, and exists
mainly to pull in dependencies. Only two components currently exist.

1. An `index.html` file that is a copy of the visual editor version. At build
   time, this causes all the visual editor code to be pulled into the JS bundle.

2. A `src/server/main.ts` file that starts an ExpressJS server, attaches the
   Board Server and Connection Server as routes, and then runs
   `ViteExpress.listen`.

Before the build, there is a `copy-assets` script that copies static assets from
the source projects into this package's `public` directory. These assets are
then picked up during the client-side build step.

Ideally, this should be sufficient to serve all three components from the same
endpoint. However, these three components were built to work with a multi-origin
paradigm. Code changes will be required in those three packages to allow them to
work in a single-origin environment.

## Known Issues

### Client-side build clobbers server-side build

The unified server has a two build steps: one for the client-side (visual
editor) and one for the server-side (local express server, which depends on
board and connection servers). Both build into the same `dist` directory.

If the `vite build` step is run second, it clobbers the output from the
`tsc build` build step, and the server-side code doesn't exist at server
startup.

Manually running `npm build:vite` followed by `npm build:tsc` does work, but
only for local development. We need a solution that works in automation. Either
by allowing these two steps to co-exist (preferable), or by forcing the build to
run in a particular order.

The server-side code is compiled to `dist/server`, but the client-side code is
compiled directly to `dist`. If the client-side code is instead compiled to
`dist/client`, then the two build steps can both successfully complete in
isolation. However, the visual editor is not currently configured to look for
assets in a `client` directory. It expects them to be in the root.

### Visual Editor shows blank screen

### Board server routing is broken
