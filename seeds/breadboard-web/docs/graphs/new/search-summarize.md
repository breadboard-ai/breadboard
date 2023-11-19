## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText68["palm-generateText <br> id='palm-generateText-68'"] -- "completion->text" --> output69{{"output <br> id='output-69'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText68["palm-generateText <br> id='palm-generateText-68'"]
secrets67("secrets <br> id='secrets-67'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText68["palm-generateText <br> id='palm-generateText-68'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate64["urlTemplate <br> id='urlTemplate-64'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata66["jsonata <br> id='jsonata-66'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate64["urlTemplate <br> id='urlTemplate-64'"] -- "url->url" --> fetch65["fetch <br> id='fetch-65'"]
fetch65["fetch <br> id='fetch-65'"] -- "response->json" --> jsonata66["jsonata <br> id='jsonata-66'"]
secrets62("secrets <br> id='secrets-62'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate64["urlTemplate <br> id='urlTemplate-64'"]
secrets63("secrets <br> id='secrets-63'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate64["urlTemplate <br> id='urlTemplate-64'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```