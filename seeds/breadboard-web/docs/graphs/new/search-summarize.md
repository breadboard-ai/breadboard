## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText23["palm-generateText <br> id='palm-generateText-23'"] -- "completion->text" --> output24{{"output <br> id='output-24'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText23["palm-generateText <br> id='palm-generateText-23'"]
secrets22("secrets <br> id='secrets-22'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText23["palm-generateText <br> id='palm-generateText-23'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate19["urlTemplate <br> id='urlTemplate-19'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata21["jsonata <br> id='jsonata-21'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate19["urlTemplate <br> id='urlTemplate-19'"] -- "url->url" --> fetch20["fetch <br> id='fetch-20'"]
fetch20["fetch <br> id='fetch-20'"] -- "response->json" --> jsonata21["jsonata <br> id='jsonata-21'"]
secrets17("secrets <br> id='secrets-17'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate19["urlTemplate <br> id='urlTemplate-19'"]
secrets18("secrets <br> id='secrets-18'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate19["urlTemplate <br> id='urlTemplate-19'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```