## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"] -- "completion->text" --> output16{{"output <br> id='output-16'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"]
secrets14("secrets <br> id='secrets-14'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate11["urlTemplate <br> id='urlTemplate-11'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata13["jsonata <br> id='jsonata-13'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate11["urlTemplate <br> id='urlTemplate-11'"] -- "url->url" --> fetch12["fetch <br> id='fetch-12'"]
fetch12["fetch <br> id='fetch-12'"] -- "response->json" --> jsonata13["jsonata <br> id='jsonata-13'"]
secrets9("secrets <br> id='secrets-9'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate11["urlTemplate <br> id='urlTemplate-11'"]
secrets10("secrets <br> id='secrets-10'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate11["urlTemplate <br> id='urlTemplate-11'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```