# Generate a board from an OpenAPI spec

This board will take an OpenAPI spec and generate a board that can be used to interact with the API. Each path will be a board that can be run and the output of the board will be the response from the API.

This board only supports JSON OpenAPI specs (so you need to convert your YAML to JSON first). Additionally it only supports OpenAPI 3.0.0 and 3.0.1.

If the board that you are using requires Bearer authentication, the key will be requested. If the board you are using requires a key in the query string you need to provide that as an input.

If the board for the API you is a POST request the board attempts to generate a body for the request based on the input text.

## Running the Board

```bash
breadboard run boards/tools/openapi/openapi.js --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\",
\"builderPath\": \"boards/tools/openapi/request-builder.json\",
\"context\": \"test\}"
```

### Inputs

- url - The url to the OpenAPI spec (JSON only for now)
- builderPath - the path to the board that will generate the request body if required (see the request-builder.json board for an example
- context - The context that will be used to generate the request body if required.)

### Outputs

- board - The generated board that has a list of boards.

## Compiling the board

`breadboard make boards/tools/openapi/openapi.js --kit @google-labs/core-kit.js > boards/tools/openapi/index.json`
