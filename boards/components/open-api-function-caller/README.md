# Open API Function Caller

This board is used to call an API as defined by an Open API spec. It will take the Open API spec and a "context" and work out which API to call based on the context. It will then call the API and generate all the correct parameters based on the content in the `context`.

Under the hood, this board uses the `openapi` board to generate the API calls and the `toolWorker` in AgentKit to make the actual call.

## Inputs

- url - The url to the OpenAPI spec (JSON only for now) that will be used
- builderPath - the path to the board that will generate the request body if required (see the request-builder.json board for an example
- context - The context that will be used to generate the request body if required.)
