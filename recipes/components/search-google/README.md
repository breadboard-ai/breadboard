# Search Google

This recipe demonstrates how to search Google using the Google Custom Search API.

## Running the Recipe

### Inputs

- `query` - The query that you want to search for

### Secrets

This recipe requires the following secrets to be set to be exported as environment variables:

- `GOOGLE_CSE_ID` - The Google Custom Search Engine ID. You can get this from the [Google Custom Search Engine Console](https://cse.google.com/cse/all).
- `PALM_KEY` - The key for the PaLM API.

### Outputs

- `search_results` - The search results from Google in JSON format. The format is as described in the [Google Custom Search API](https://developers.google.com/custom-search/v1/reference/rest/v1/Search).

### From the CLI

```bash
breadboard run recipes/components/search-google/index.js --kit @google-labs/llm-starter -i "{\"query\":\"Testing\"}"
```

### From the UI

```bash
breadboard debug recipes/components/search-google/index.js
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
fetch6["fetch <br> id='fetch-6'"] -- "response->response" --> search_results{{"output <br> id='search_results'"}}:::output
urlTemplate5["urlTemplate <br> id='urlTemplate-5'"] -- "url->url" --> fetch6["fetch <br> id='fetch-6'"]
input[/"input <br> id='input'"/]:::input -- "query->query" --> urlTemplate5["urlTemplate <br> id='urlTemplate-5'"]
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> urlTemplate5["urlTemplate <br> id='urlTemplate-5'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate5["urlTemplate <br> id='urlTemplate-5'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```
