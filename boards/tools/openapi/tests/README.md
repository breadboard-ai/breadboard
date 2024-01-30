# Tests for the OpenAPI Board

## Running the Board

```bash
breadboard run boards/tools/openapi/tests/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\"}"
```

### XKCD API test

```bash
breadboard run boards/tools/openapi/tests/xkcd.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/xkcd.com/1.0.0/openapi.json\"}"
```

### Inputs

- url - The url to the OpenAPI spec (JSON only for now)
