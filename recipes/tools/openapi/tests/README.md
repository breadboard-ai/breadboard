# Tests for the OpenAPI Recipe

## Running the Recipe

```bash
breadboard run recipes/tools/openapi/tests/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\"}"
```

### Inputs

- url - The url to the OpenAPI spec (JSON only for now)
