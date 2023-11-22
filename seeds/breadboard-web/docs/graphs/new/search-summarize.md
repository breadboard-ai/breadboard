## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText67["palm-generateText <br> id='palm-generateText-67'"] -- "completion->text" --> output68{{"output <br> id='output-68'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> palmgenerateText67["palm-generateText <br> id='palm-generateText-67'"]
secrets66("secrets <br> id='secrets-66'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText67["palm-generateText <br> id='palm-generateText-67'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate63["urlTemplate <br> id='urlTemplate-63'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
jsonata65["jsonata <br> id='jsonata-65'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
urlTemplate63["urlTemplate <br> id='urlTemplate-63'"] -- "url->url" --> fetch64["fetch <br> id='fetch-64'"]
fetch64["fetch <br> id='fetch-64'"] -- "response->json" --> jsonata65["jsonata <br> id='jsonata-65'"]
secrets61("secrets <br> id='secrets-61'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate63["urlTemplate <br> id='urlTemplate-63'"]
secrets62("secrets <br> id='secrets-62'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate63["urlTemplate <br> id='urlTemplate-63'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```