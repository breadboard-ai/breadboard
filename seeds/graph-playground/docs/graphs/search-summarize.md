# search-summarize
  - Original: [`search-summarize.ts`](../../src/boards/search-summarize.ts)
  - Graph: [`search-summarize.json`](../../graphs/search-summarize.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
textCompletion1["textCompletion id='textCompletion-1'"] -- "completion->text" --> output2{{"output id='output-2'"}}:::output
summarizingtemplate["promptTemplate id='summarizing-template'"] -- "prompt->text" --> textCompletion1["textCompletion id='textCompletion-1'"]
jsonata5["jsonata id='jsonata-5'"] -- "result->context" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
fetch4["fetch id='fetch-4'"] -- "response->json" --> jsonata5["jsonata id='jsonata-5'"]
urlTemplate3["urlTemplate id='urlTemplate-3'"] -- "url->url" --> fetch4["fetch id='fetch-4'"]
secrets6("secrets id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> textCompletion1["textCompletion id='textCompletion-1'"]
secrets6("secrets id='secrets-6'"):::secrets -- "PALM_KEY->PALM_KEY" --> urlTemplate3["urlTemplate id='urlTemplate-3'"]
secrets6("secrets id='secrets-6'"):::secrets -- "GOOGLE_CSE_ID->GOOGLE_CSE_ID" --> urlTemplate3["urlTemplate id='urlTemplate-3'"]
input[/"input id='input'"/]:::input -- "text->question" --> summarizingtemplate["promptTemplate id='summarizing-template'"]
input[/"input id='input'"/]:::input -- "text->query" --> urlTemplate3["urlTemplate id='urlTemplate-3'"]
templatesummarizingtemplate[template]:::config -- "template->template" --o summarizingtemplate
templateurlTemplate3[template]:::config -- "template->template" --o urlTemplate3
expressionjsonata5[expression]:::config -- "expression->expression" --o jsonata5
keyssecrets6[keys]:::config -- "keys->keys" --o secrets6
messageinput[message]:::config -- "message->message" --o input
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```