# Fetch RSS Feed

This recipe demonstrates how to fetch an RSS feed return the items and metadata.

## Running the Recipe

### Inputs

- `url` - The URL of the RSS feed

### Outputs

- `feedItems` - An array of items from the RSS feed
- `feedMetaData` - Metadata about the RSS feed

### From the CLI

```bash
breadboard run recipes/use-case/fetch-rss/index.js --kit @google-labs/llm-starter -i {\"url\":\"https://paul.kinlan.me/index.xml\"}"
```

### From the UI

```bash
breadboard debug recipes/use-case/fetch-rss/index.js
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
