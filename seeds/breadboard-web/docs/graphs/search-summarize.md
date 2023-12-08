## search-summarize.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
generator["invoke <br> id='generator'"] -- "text->text" --> output1{{"output <br> id='output-1'"}}:::output
summarizingtemplate["promptTemplate <br> id='summarizing-template'"] -- "prompt->text" --> generator["invoke <br> id='generator'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "result->context" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
fetch3["fetch <br> id='fetch-3'"] -- "response->json" --> jsonata4["jsonata <br> id='jsonata-4'"]
urlTemplate2["urlTemplate <br> id='urlTemplate-2'"] -- "url->url" --> fetch3["fetch <br> id='fetch-3'"]
secrets5("secrets <br> id='secrets-5'"):::secrets -- "API_KEY->API_KEY" --> urlTemplate2["urlTemplate <br> id='urlTemplate-2'"]
secrets5("secrets <br> id='secrets-5'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate2["urlTemplate <br> id='urlTemplate-2'"]
input[/"input <br> id='input'"/]:::input -- "generator->path" --> generator["invoke <br> id='generator'"]
input[/"input <br> id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate <br> id='summarizing-template'"]
input[/"input <br> id='input'"/]:::input -- "text->query" --> urlTemplate2["urlTemplate <br> id='urlTemplate-2'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```