## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText22["palm-generateText <br> id='palm-generateText-22'"] -- "completion->text" --> output23{{"output <br> id='output-23'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText22["palm-generateText <br> id='palm-generateText-22'"]
secrets21("secrets <br> id='secrets-21'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText22["palm-generateText <br> id='palm-generateText-22'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate18["urlTemplate <br> id='urlTemplate-18'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata20["jsonata <br> id='jsonata-20'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate18["urlTemplate <br> id='urlTemplate-18'"] -- "url->url" --> fetch19["fetch <br> id='fetch-19'"]
fetch19["fetch <br> id='fetch-19'"] -- "response->json" --> jsonata20["jsonata <br> id='jsonata-20'"]
secrets16("secrets <br> id='secrets-16'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate18["urlTemplate <br> id='urlTemplate-18'"]
secrets17("secrets <br> id='secrets-17'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate18["urlTemplate <br> id='urlTemplate-18'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```