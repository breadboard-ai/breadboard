---
title: Using Breadboard in Web Applications
description: A comprehensive guide to integrating Breadboard into vanilla JavaScript, Lit, and React applications.
---

# Using Breadboard in Web Applications

This guide walks you through integrating an existing Breadboard into a web application. By the end, you'll have a working implementation that loads a board, handles inputs/outputs, and manages the board lifecycle.

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed (for npm-based approaches)
- An existing Breadboard JSON file from the [Happy Path](../happy-path/) tutorial
- Basic knowledge of HTML, CSS, and JavaScript
- Familiarity with your chosen framework (Lit or React) if applicable

## Quick Start (5-Minute Vanilla JS)

Create an `index.html` file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Breadboard Integration</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    #output { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
    button { padding: 0.5rem 1rem; cursor: pointer; }
    .error { color: #d32f2f; }
  </style>
</head>
<body>
  <h1>My Breadboard App</h1>
  <button id="run">Run Board</button>
  <div id="output"></div>

  <script type="module">
    import { Board } from "https://unpkg.com/@google-labs/breadboard@latest/dist/breadboard.js";
    
    const boardJson = {
      // Paste your board JSON here
      "nodes": [],
      "edges": []
    };

    document.getElementById('run').addEventListener('click', async () => {
      const output = document.getElementById('output');
      output.innerHTML = 'Running...';
      
      try {
        const board = await Board.fromJSON(boardJson);
        const result = await board.runOnce({});
        output.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
      } catch (error) {
        output.innerHTML = `<div class="error">Error: ${error.message}</div>`;
      }
    });
  </script>
</body>
</html>
```

Replace the `boardJson` content with your actual board configuration.

## Installation Options

### Option 1: CDN (Quickest)
```html
<script type="module">
  import { Board } from "https://unpkg.com/@google-labs/breadboard@latest/dist/breadboard.js";
</script>
```

### Option 2: NPM
```bash
npm install @google-labs/breadboard
```

```javascript
import { Board } from "@google-labs/breadboard";
```

## Loading Boards

### From JSON Object
```javascript
const board = await Board.fromJSON(boardJson);
```

### From URL
```javascript
const board = await Board.load("https://example.com/my-board.json");
```

### From File (Node.js/Bundler)
```javascript
import boardJson from "./my-board.json" assert { type: "json" };
const board = await Board.fromJSON(boardJson);
```

## Detailed Walkthrough

### Basic Implementation

```javascript
import { Board } from "@google-labs/breadboard";

async function runBoard() {
  // Load the board
  const board = await Board.fromJSON(boardJson);
  
  // Run with inputs
  const inputs = { message: "Hello, Breadboard!" };
  const outputs = await board.runOnce(inputs);
  
  console.log("Result:", outputs);
}
```

### Handling Inputs and Outputs

Boards may require multiple interactions. Use `run()` for full control:

```javascript
const board = await Board.fromJSON(boardJson);

for await (const result of board.run({ inputs: { prompt: "Hello" } })) {
  if (result.type === "input") {
    // Board is requesting input
    console.log("Input required:", result.data);
  } else if (result.type === "output") {
    // Board produced output
    console.log("Output:", result.data);
  }
}
```

### Lifecycle Events

```javascript
const board = await Board.fromJSON(boardJson);

// Listen to all events
board.addEventListener("node", (event) => {
  console.log("Node executed:", event.detail.node.id);
});

board.addEventListener("error", (event) => {
  console.error("Board error:", event.detail.error);
});
```

## Framework Integration

### Lit Integration

Install dependencies:
```bash
npm install @google-labs/breadboard lit
```

Create a component:

```javascript
import { LitElement, html, css } from "lit";
import { Board } from "@google-labs/breadboard";

export class BreadboardRunner extends LitElement {
  static styles = css`
    :host { display: block; padding: 1rem; }
    .output { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
    .error { color: #d32f2f; }
  `;
  
  static properties = {
    boardUrl: { type: String },
    result: { state: true },
    error: { state: true }
  };
  
  async runBoard() {
    try {
      const board = await Board.load(this.boardUrl);
      this.result = await board.runOnce({});
      this.error = null;
    } catch (err) {
      this.error = err.message;
      this.result = null;
    }
  }
  
  render() {
    return html`
      <button @click="${this.runBoard}">Run Board</button>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      ${this.result ? html`<pre class="output">${JSON.stringify(this.result, null, 2)}</pre>` : ""}
    `;
  }
}

customElements.define("breadboard-runner", BreadboardRunner);
```

Usage:
```html
<breadboard-runner boardUrl="./my-board.json"></breadboard-runner>
```

### React Integration

Install dependencies:
```bash
npm install @google-labs/breadboard react react-dom
```

Create a component:

```jsx
import { useState } from "react";
import { Board } from "@google-labs/breadboard";

function BreadboardComponent({ boardJson }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runBoard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const board = await Board.fromJSON(boardJson);
      const output = await board.runOnce({});
      setResult(output);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={runBoard} disabled={loading}>
        {loading ? "Running..." : "Run Board"}
      </button>
      
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      
      {result && (
        <pre style={{ background: "#f5f5f5", padding: "1rem" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default BreadboardComponent;
```

## Advanced Usage

### Handling Streams

```javascript
const board = await Board.fromJSON(boardJson);

for await (const chunk of board.run({ inputs: {}, stream: true })) {
  if (chunk.type === "output") {
    // Stream partial outputs
    updateUI(chunk.data);
  }
}
```

### Managing Secrets

```javascript
const board = await Board.fromJSON(boardJson);

const result = await board.runOnce({
  // Public inputs
  query: "What is the weather?",
  
  // Secrets (in production, use environment variables)
  API_KEY: process.env.API_KEY
});
```

### Loading Kits

```javascript
import { Core } from "@google-labs/core-kit";

const board = await Board.fromJSON(boardJson);
const core = new Core();

// Register kits before running
board.addKit(core);
```

## Error Handling and Debugging

### Common Errors

**Board fails to load:**
```javascript
try {
  const board = await Board.load(url);
} catch (error) {
  if (error.message.includes("404")) {
    console.error("Board file not found. Check the URL.");
  }
}
```

**Missing inputs:**
```javascript
try {
  await board.runOnce({});
} catch (error) {
  if (error.message.includes("input")) {
    console.error("Missing required input. Check board schema.");
  }
}
```

### Debugging Tips

1. **Enable verbose logging:**
```javascript
const board = await Board.fromJSON(boardJson, { verbose: true });
```

2. **Inspect board structure:**
```javascript
console.log("Nodes:", board.nodes);
console.log("Edges:", board.edges);
```

3. **Validate JSON:**
Ensure your board JSON is valid before loading:
```javascript
JSON.parse(boardJsonString); // Throws if invalid
```

## Deployment Considerations

### Security
- Never expose API keys in client-side code
- Use environment variables for secrets
- Consider proxying board requests through your backend

### Performance
- Cache board JSON files
- Use CDN for production loads
- Implement loading states for better UX

### Browser Support
Breadboard requires modern browsers with ES module support:
- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Board is not defined` | Ensure module script type: `<script type="module">` |
| `Failed to fetch` | Check CORS headers on board JSON URL |
| `Missing input` | Verify all required inputs are provided to `runOnce()` |
| `Kit not found` | Register required kits with `board.addKit()` before running |

## Complete Standalone Example

Save this as `complete-example.html` and open in a browser:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Breadboard Example</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      max-width: 800px; 
      margin: 2rem auto; 
      padding: 0 1rem;
      line-height: 1.6;
    }
    .container { background: #fafafa; padding: 2rem; border-radius: 8px; }
    button { 
      background: #1a73e8; 
      color: white; 
      border: none; 
      padding: 0.75rem 1.5rem; 
      border-radius: 4px; 
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: #1557b0; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    #output { 
      margin-top: 1rem; 
      padding: 1rem; 
      background: white; 
      border: 1px solid #ddd;
      border-radius: 4px;
      min-height: 100px;
      white-space: pre-wrap;
      font-family: monospace;
    }
    .error { color: #d32f2f; border-left: 4px solid #d32f2f; padding-left: 1rem; }
    .success { color: #388e3c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍞 Breadboard Integration Demo</h1>
    <p>This example loads a simple board and displays the result.</p>
    
    <button id="runBtn" onclick="runBoard()">Run Board</button>
    <div id="output">Click "Run Board" to see results...</div>
  </div>

  <script type="module">
    import { Board } from "https://unpkg.com/@google-labs/breadboard@latest/dist/breadboard.js";
    
    // Example board: Simple input -> output passthrough
    const exampleBoard = {
      "title": "Hello World",
      "description": "A simple example board",
      "version": "1.0.0",
      "nodes": [
        {
          "id": "input",
          "type": "input",
          "configuration": {
            "schema": {
              "type": "object",
              "properties": {
                "message": {
                  "type": "string",
                  "description": "Message to process"
                }
              }
            }
          }
        },
        {
          "id": "output",
          "type": "output"
        }
      ],
      "edges": [
        {
          "from": "input",
          "to": "output",
          "out": "message",
          "in": "message"
        }
      ]
    };

    window.runBoard = async function() {
      const output = document.getElementById('output');
      const btn = document.getElementById('runBtn');
      
      btn.disabled = true;
      output.textContent = 'Running board...';
      output.className = '';
      
      try {
        const board = await Board.fromJSON(exampleBoard);
        const result = await board.runOnce({ message: "Hello from Breadboard!" });
        
        output.innerHTML = `<span class="success">✓ Success!</span>\n\n${JSON.stringify(result, null, 2)}`;
      } catch (error) {
        output.innerHTML = `<div class="error">✗ Error: ${error.message}</div>`;
        console.error(error);
      } finally {
        btn.disabled = false;
      }
    };
  </script>
</body>
</html>
```

This complete example works without any build step—just save and open in a browser.

## Next Steps

- Explore the [Breadboard API Reference](../api/)
- Learn about [Creating Custom Kits](../kits/)
- Join the [Discord community](https://discord.gg/breadboard) for support
