## search-summarize-as-action.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText62["palm-generateText <br> id='palm-generateText-62'"] -- "completion->text" --> output55{{"output <br> id='output-55'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText62["palm-generateText <br> id='palm-generateText-62'"]
secrets61("secrets <br> id='secrets-61'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText62["palm-generateText <br> id='palm-generateText-62'"]
input54[/"input <br> id='input-54'"/]:::input -- "text->query" --> urlTemplate58["urlTemplate <br> id='urlTemplate-58'"]
input54[/"input <br> id='input-54'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata60["jsonata <br> id='jsonata-60'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate58["urlTemplate <br> id='urlTemplate-58'"] -- "url->url" --> fetch59["fetch <br> id='fetch-59'"]
fetch59["fetch <br> id='fetch-59'"] -- "response->json" --> jsonata60["jsonata <br> id='jsonata-60'"]
secrets56("secrets <br> id='secrets-56'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate58["urlTemplate <br> id='urlTemplate-58'"]
secrets57("secrets <br> id='secrets-57'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate58["urlTemplate <br> id='urlTemplate-58'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```