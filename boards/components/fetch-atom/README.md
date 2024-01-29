# Fetch ATOM Feed

This board demonstrates how to fetch an ATOM feed return the items and metadata.

## Running the Board

### Inputs

- `url` - The URL of the ATOM feed

### Outputs

- `feedItems` - An array of items from the ATOM feed
- `feedMetaData` - Metadata about the ATOM feed

### From the CLI

```bash
breadboard run boards/components/fetch-atom/index.js --kit @google-labs/llm-starter -i {\"url\":\"https://blog.chromium.org/feeds/posts/default\"}"
```

### From the UI

```bash
breadboard debug boards/components/fetch-atom/index.js
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
jsonata4["jsonata <br> id='jsonata-4'"] -- "result->items" --> feedItems{{"output <br> id='feedItems'"}}:::output
xmlToJson["xmlToJson <br> id='xmlToJson'"] -- "json->json" --> jsonata3["jsonata <br> id='jsonata-3'"]
xmlToJson["xmlToJson <br> id='xmlToJson'"] -- "json->json" --> jsonata4["jsonata <br> id='jsonata-4'"]
fetch["fetch <br> id='fetch'"] -- "response->xml" --> xmlToJson["xmlToJson <br> id='xmlToJson'"]
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->feed" --> feedMetaData{{"output <br> id='feedMetaData'"}}:::output
input[/"input <br> id='input'"/]:::input -- "url->url" --> fetch["fetch <br> id='fetch'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```
