# JSON Kit

The JSON Kit provides nodes for parsing, stringifying, and validating JSON data within Breadboard boards.

## Installation

```bash
npm install @google-labs/json-kit
```

## Nodes

### json.parse

Parses a JSON string into a JavaScript value.

**Inputs:**
- `json` (string): The JSON string to parse

**Outputs:**
- `json` (unknown): The parsed value
- `error` (string): Error message if parsing fails

**Example:**

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

const rawJson = input({ description: "JSON string to parse" });

const parsed = json.parse({
  $id: "parse",
  json: rawJson,
});

export default board({
  inputs: { rawJson },
  outputs: { 
    result: parsed.json,
    error: parsed.error 
  },
});
```

### json.stringify

Converts a JavaScript value to a JSON string.

**Inputs:**
- `json` (unknown): The value to convert
- `indent` (number, optional): Number of spaces for indentation (default: 2)

**Outputs:**
- `json` (string): The JSON string

**Example:**

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

const data = input({ description: "Data to stringify" });

const stringified = json.stringify({
  $id: "stringify",
  json: data,
  indent: 2,
});

export default board({
  inputs: { data },
  outputs: { jsonString: stringified.json },
});
```

### json.validate

Validates JSON data against a JSON Schema.

**Inputs:**
- `json` (unknown): The value to validate
- `schema` (object): JSON Schema object

**Outputs:**
- `json` (unknown): The validated value (if valid)
- `valid` (boolean): Whether validation passed
- `error` (string): Validation error message (if invalid)

**Example:**

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

const data = input({ description: "Data to validate" });
const schema = input({ description: "JSON Schema" });

const validated = json.validate({
  $id: "validate",
  json: data,
  schema: schema,
});

export default board({
  inputs: { data, schema },
  outputs: {
    isValid: validated.valid,
    result: validated.json,
    error: validated.error,
  },
});
```

## Error Handling

Handle malformed JSON using the error output:

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

const rawJson = input({ description: "Raw JSON string" });

const parsed = json.parse({
  $id: "safeParse",
  json: rawJson,
});

export default board({
  inputs: { rawJson },
  outputs: {
    data: parsed.json,
    parseError: parsed.error,
  },
});
```

## Integration Patterns

### Chaining with Core Kit

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";
import { core } from "@google-labs/core-kit";

const jsonString = input({ description: "Input JSON" });

const parsed = json.parse({
  $id: "parse",
  json: jsonString,
});

const processed = core.invoke({
  $id: "process",
  path: "./process-board.json",
  data: parsed.json,
});

const result = json.stringify({
  $id: "stringify",
  json: processed.result,
});

export default board({
  inputs: { jsonString },
  outputs: { result: result.json },
});
```

### Validation Pipeline

```typescript
import { board, input } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

const rawData = input({ description: "Raw JSON string" });
const schema = input({ description: "Validation schema" });

const parsed = json.parse({
  $id: "parse",
  json: rawData,
});

const validated = json.validate({
  $id: "validate",
  json: parsed.json,
  schema: schema,
});

export default board({
  inputs: { rawData, schema },
  outputs: {
    data: validated.json,
    isValid: validated.valid,
    validationError: validated.error,
  },
});
```

## TypeScript Types

```typescript
import type { InputValues, OutputValues } from "@google-labs/breadboard";

export interface ParseInputs extends InputValues {
  json: string;
}

export interface ParseOutputs extends OutputValues {
  json?: unknown;
  error?: string;
}

export interface StringifyInputs extends InputValues {
  json: unknown;
  indent?: number;
}

export interface StringifyOutputs extends OutputValues {
  json: string;
}

export interface ValidateInputs extends InputValues {
  json: unknown;
  schema: object;
}

export interface ValidateOutputs extends OutputValues {
  json?: unknown;
  valid?: boolean;
  error?: string;
}
```
