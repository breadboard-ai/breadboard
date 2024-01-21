# JSON Kit

![Milestone](https://img.shields.io/badge/milestone-M3-red) ![Stability](https://img.shields.io/badge/stability-wip-green)

A [Breadboard](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard/) Kit containing nodes that help wrangle JSON.

## Node Reference

This kit contains the following nodes:

### The `schemish` node

Converts a given JSON schema to [Schemish](https://glazkov.com/2023/05/06/schemish/)

### The `validateJson` node

Validates given JSON against a given JSON Schema.

### The `jsonata` node

Use this node to execute [JSONata](https://jsonata.org/) expressions. JSONata is a versatile JSON query language.

#### Example:

If we send the following inputs to `jsonata`:

```json
{
  "expression": "$join(items.snippet, '\n')",
  "json": {
    "items": [
      {
        "snippet": "Question: How old is planet Earth?"
      },
      {
        "snippet": "Thought: I wonder how old planet Earth is?"
      }
    ]
  }
}
```

We will get this output:

```json
{
  "result": "Question: How old is planet Earth?\nThought: I wonder how old planet Earth is?"
}
```

#### Inputs:

- `expression` -- required, a string that contains the JSONata expression to be executed.
- `raw` -- an optional boolean that specifies whether the result of the expression should be passed as-is (`true`), or it should be passed as the `result` output property (`false`, default).
- `json` -- an optional JSON object that will be used as the context for the expression. If `json` is not specified, the node will use the input property bag (minus `expression` and `raw`) as the context.

#### Outputs:

- `result` -- the result of the expression, unless `raw` is `true`. In the latter case, the result is passed as-is.

#### Implementation:

- [src/nodes/jsonata.ts](src/nodes/jsonata.ts)
