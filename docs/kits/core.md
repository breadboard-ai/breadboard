# Core Kit

The Core Kit provides essential nodes for Breadboard graphs, including input/output handling, flow control, and data transformation.

## Installation

```bash
npm install @google-labs/core-kit
```

## Usage

Import the core kit and use its nodes within your boards:

```typescript
import { board } from "@breadboard-ai/build";
import { coreKit } from "@google-labs/core-kit";
```

## Nodes

### input / output

Define board inputs and outputs with JSON schemas:

```typescript
import { board, string } from "@breadboard-ai/build";

const myBoard = board({
  inputs: {
    message: string({ description: "Input message" }),
  },
  outputs: {
    result: string({ description: "Output result" }),
  },
}, ({ message }) => {
  return { result: `Processed: ${message}` };
});
```

### invoke

Invoke another board or function:

```typescript
import { board, string } from "@breadboard-ai/build";
import { coreKit } from "@google-labs/core-kit";

const helper = board({
  inputs: { text: string() },
  outputs: { reversed: string() },
}, ({ text }) => ({
  reversed: text.split("").reverse().join(""),
}));

const main = board({
  inputs: { input: string() },
  outputs: { output: string() },
}, ({ input }) => {
  const result = coreKit.invoke({
    board: helper,
    text: input,
  });
  return { output: result.reversed };
});
```

### map

Map over arrays:

```typescript
import { board, array, string } from "@breadboard-ai/build";
import { coreKit } from "@google-labs/core-kit";

const processItem = board({
  inputs: { item: string() },
  outputs: { upper: string() },
}, ({ item }) => ({ upper: item.toUpperCase() }));

const main = board({
  inputs: { items: array(string()) },
  outputs: { results: array(string()) },
}, ({ items }) => {
  const mapped = coreKit.map({
    list: items,
    board: processItem,
    item: "item",
  });
  return { results: mapped.list };
});
```

### reduce

Reduce arrays to single values:

```typescript
import { board, array, number } from "@breadboard-ai/build";
import { coreKit } from "@google-labs/core-kit";

const summer = board({
  inputs: { accumulator: number(), item: number() },
  outputs: { accumulator: number() },
}, ({ accumulator, item }) => ({
  accumulator: accumulator + item,
}));

const main = board({
  inputs: { numbers: array(number()) },
  outputs: { sum: number() },
}, ({ numbers }) => {
  const result = coreKit.reduce({
    list: numbers,
    board: summer,
    accumulator: 0,
  });
  return { sum: result.accumulator };
});
```

### secrets

Access environment secrets:

```typescript
import { board, string } from "@breadboard-ai/build";
import { coreKit } from "@google-labs/core-kit";

const secureBoard = board({
  inputs: {},
  outputs: { key: string() },
}, () => {
  const secrets = coreKit.secrets({ keys: ["API_KEY"] });
  return { key: secrets.API_KEY };
});
```

## Error Handling

Handle errors within node implementations:

```typescript
import { board, string } from "@breadboard-ai/build";

const safeParse = board({
  inputs: { json: string() },
  outputs: { data: string(), error: string() },
}, ({ json }) => {
  try {
    const parsed = JSON.parse(json);
    return { data: JSON.stringify(parsed), error: "" };
  } catch (e) {
    return { data: "", error: (e as Error).message };
  }
});
```

## Declarative Syntax

Core kit nodes can also be used in declarative graph definitions:

```yaml
title: Core Kit Example
nodes:
  - id: input
    type: input
    configuration:
      schema:
        type: object
        properties:
          text:
            type: string
  
  - id: process
    type: invoke
    configuration:
      path: ./helper.bgl.json
  
  - id: output
    type: output
    configuration:
      schema:
        type: object
        properties:
          result:
            type: string

edges:
  - from: input
    to: process
    out: text
    in: input
  
  - from: process
    to: output
    out: result
    in: result
```
