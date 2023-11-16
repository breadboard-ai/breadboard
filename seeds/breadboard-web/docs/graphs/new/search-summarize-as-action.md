## search-summarize-as-action.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
passthrough61(("passthrough <br> id='passthrough-61'")):::passthrough -- all --> output53{{"output <br> id='output-53'"}}:::output
generateText60["generateText <br> id='generateText-60'"] -- "completion->text" --> passthrough61(("passthrough <br> id='passthrough-61'")):::passthrough
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> generateText60["generateText <br> id='generateText-60'"]
secrets59("secrets <br> id='secrets-59'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText60["generateText <br> id='generateText-60'"]
input52[/"input <br> id='input-52'"/]:::input -- "text->query" --> urlTemplate56["urlTemplate <br> id='urlTemplate-56'"]
input52[/"input <br> id='input-52'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata58["jsonata <br> id='jsonata-58'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate56["urlTemplate <br> id='urlTemplate-56'"] -- "url->url" --> fetch57["fetch <br> id='fetch-57'"]
fetch57["fetch <br> id='fetch-57'"] -- "response->json" --> jsonata58["jsonata <br> id='jsonata-58'"]
secrets54("secrets <br> id='secrets-54'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate56["urlTemplate <br> id='urlTemplate-56'"]
secrets55("secrets <br> id='secrets-55'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate56["urlTemplate <br> id='urlTemplate-56'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```