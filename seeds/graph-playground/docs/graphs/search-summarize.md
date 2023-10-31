# search-summarize
  - Original: [`search-summarize.ts`](../../src/boards/search-summarize.ts)
  - Graph: [`search-summarize.json`](../../graphs/search-summarize.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
generateText1["generateText <br> id='generateText-1'"] -- "completion->text" --> output2{{"output <br> id='output-2'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> generateText1["generateText <br> id='generateText-1'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
fetch4["fetch <br> id='fetch-4'"] -- "response->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
urlTemplate3["urlTemplate <br> id='urlTemplate-3'"] -- "url->url" --> fetch4["fetch <br> id='fetch-4'"]
secrets6("secrets <br> id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText1["generateText <br> id='generateText-1'"]
secrets6("secrets <br> id='secrets-6'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
secrets6("secrets <br> id='secrets-6'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate3["urlTemplate <br> id='urlTemplate-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```