# Breadboard Vanilla JS Example

A minimal, complete example of running a Breadboard in the browser without any build tools or package management.

## What's Included

- `index.html` - A self-contained HTML file that loads Breadboard from a CDN and runs a simple greeting board

## How to Run

Simply open `index.html` in any modern web browser:

```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Or use a local development server (recommended for ES modules):

```bash
npx serve .
# or
python -m http.server 8000
```

Then navigate to `http://localhost:8000` (or the appropriate port).

## What It Demonstrates

1. **CDN Loading** - Loads `@breadboard-ai/core` directly from unpkg
2. **Board Definition** - Defines a board inline as JSON (BGL format)
3. **Node Types** - Uses `input`, `runJavascript`, and `output` nodes
4. **Execution** - Runs the board with user input and displays results
5. **Error Handling** - Catches and displays runtime errors

## The Board

The example board:
1. Takes a `name` input
2. Passes it to a JavaScript node that creates a greeting
3. Returns the greeting via the output node

## Browser Compatibility

Requires a modern browser with ES module support (Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+).