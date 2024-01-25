# Breadboard Extension

This is a VSCode extension for Breadboard. It is currently an unpublished
extension that you build and install yourself.

## Installation

1. Build the extension: `npm run package`
2. Locate the `debugger.vsix` in VSCode, right click and choose "Install Extension VSIX". Alternatively go to your Extensions in VSCode, head to the overflow menu (`...`) and choose "Install Extension VSIX..."

## Usage

Currently the extension supports the JSON boards, though the plan is to support TypeScript board debugging, too. Head to a JSON board and either:

1. Hit F5 to start the debugger.
2. Cmd + Shift + P and choose "Breadboard: Run Board"

The board will be loaded into the debugger and paused. You should get the board details in the variables view and you can either

### Breakpoints

If you want to use breakpoints, you can set a function breakpoint in the debugger UI. You should set the ID of the node you wish to break on. When the Breadboard runner reaches a node with that ID it will automatically suspend execution.

### Secrets

If you keep a `.env` file in your workspace it will be loaded by the runtime when a debugging session begins. It will be used for autofilling secrets wherever possible.

## Development

### Architecture

While there are a lot of ways to build debugger extensions for VSCode, this one takes a fairly direct approach inasmuch as it spins up the Breadboard "Debugger" inline rather than as a separate process.

There are four key files:

1. `package.json`: has the `contributes` property that informs VSCode about the debugger type (`breadboard`), the commands that you can run, and the initial configuration/snippets to use when someone launches the debugger.
1. `extension.ts`: sets up the factory that VSCode expects to use for any debug session. It also wires up the behaviors of the commands in the `package.json`.
1. `breadboard-debug-session.ts`: declares the features that are supported by the debugger and handles the [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) requests coming in from VSCode and mediates messages to and from the actual Debug Runtime.
1. `breadboard-debug-runtime.ts`: is the actual runner that instantiates Breadboard, runs the board, tracks variables, and emits events that the Debug Session mediates and sends back to VSCode.

While it would be possible to merge the session and runtime classes, VSCode's idiom's suggest keeping them as separate entities.

### Build & Run

To build

1. `npm run build --watch`
1. Open `extension.ts` in VSCode and press F5. If asked, choose "VS Code Extension Development". This will spin up a dedicated "Extension Host" window with the extension side-loaded. From here you should be able to try out features that you're developing. Any output logs from the "Extension Host" will be shown in the Debug Console panel of the window from which you launched the "Extension Host"
