## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText69["palm-generateText <br> id='palm-generateText-69'"] -- "completion->text" --> output70{{"output <br> id='output-70'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText69["palm-generateText <br> id='palm-generateText-69'"]
secrets68("secrets <br> id='secrets-68'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText69["palm-generateText <br> id='palm-generateText-69'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate65["urlTemplate <br> id='urlTemplate-65'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata67["jsonata <br> id='jsonata-67'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate65["urlTemplate <br> id='urlTemplate-65'"] -- "url->url" --> fetch66["fetch <br> id='fetch-66'"]
fetch66["fetch <br> id='fetch-66'"] -- "response->json" --> jsonata67["jsonata <br> id='jsonata-67'"]
secrets63("secrets <br> id='secrets-63'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate65["urlTemplate <br> id='urlTemplate-65'"]
secrets64("secrets <br> id='secrets-64'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate65["urlTemplate <br> id='urlTemplate-65'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```