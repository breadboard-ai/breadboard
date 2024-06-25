# just-search
  - Original: [`just-search.ts`](../../src/boards/just-search.ts)
  - Graph: [`just-search.json`](../../graphs/just-search.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --o urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->text" --> output6{{"output <br> id='output-6'"}}:::output
fetch4["fetch <br> id='fetch-4'"] -- "response->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
urlTemplate3["urlTemplate <br> id='urlTemplate-3'"] -- "url->url" --> fetch4["fetch <br> id='fetch-4'"]
input2[/"input <br> id='input-2'"/]:::input -- "text->query" --> urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```