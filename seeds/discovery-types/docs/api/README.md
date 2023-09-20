@google-labs/discovery-types / [Exports](modules.md)

# The simplest possible Discovery -> TypeScript declarations converter

Made primarily to read the PaLM API Discovery doc and spit out nice TypeScript declarations.

To use:

```ts
import { config } from "dotenv";

import { toTypes } from "@google-labs/discovery-types";

config();

const DISCOVER_DOC_URL =
  "https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta2";
const { API_KEY } = process.env;
if (!API_KEY) throw new Error("API_KEY is not defined");

const response = await fetch(`${DISCOVER_DOC_URL}&key=${API_KEY}`);
const doc = await response.json();

const types = toTypes(doc);
console.log(types);
```
