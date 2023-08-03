# react-with-jsonata
  - Original: [`react-with-jsonata.ts`](../../src/boards/react-with-jsonata.ts)
  - Graph: [`react-with-jsonata.json`](../../graphs/react-with-jsonata.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
reflect5["reflect
id='reflect-5'"] -- "graph->json" --> jsonata3["jsonata
id='jsonata-3'"]
reflect5["reflect
id='reflect-5'"] -- "graph->json" --> jsonata4["jsonata
id='jsonata-4'"]
jsonata4["jsonata
id='jsonata-4'"] -- "result->descriptions" --o promptTemplate6["promptTemplate
id='promptTemplate-6'"]
jsonata3["jsonata
id='jsonata-3'"] -- "result->tools" --o promptTemplate6["promptTemplate
id='promptTemplate-6'"]
localMemory2["localMemory
id='localMemory-2'"] -- "context->memory" --> promptTemplate6["promptTemplate
id='promptTemplate-6'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion
id='react-completion'"]
math[["include
id='math'"]]:::include -- "text->Observation" --> localMemory2["localMemory
id='localMemory-2'"]
search[["include
id='search'"]]:::include -- "text->Observation" --> localMemory2["localMemory
id='localMemory-2'"]
jsonata8["jsonata
id='jsonata-8'"] -- "search->text" --> search[["include
id='search'"]]:::include
jsonata8["jsonata
id='jsonata-8'"] -- "math->text" --> math[["include
id='math'"]]:::include
jsonata8["jsonata
id='jsonata-8'"] -- "answer->text" --> output9{{"output
id='output-9'"}}:::output
reactcompletion["textCompletion
id='react-completion'"] -- "completion->json" --> jsonata8["jsonata
id='jsonata-8'"]
reactcompletion["textCompletion
id='react-completion'"] -- "completion->Thought" --> rememberthought["localMemory
id='remember-thought'"]
promptTemplate6["promptTemplate
id='promptTemplate-6'"] -- "prompt->text" --> reactcompletion["textCompletion
id='react-completion'"]
rememberquestion["localMemory
id='remember-question'"] -- "context->memory" --> promptTemplate6["promptTemplate
id='promptTemplate-6'"]
input7[/"input
id='input-7'"/]:::input -- "text->Question" --> rememberquestion["localMemory
id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
templatepromptTemplate6[template]:::config -- "template->template" --o promptTemplate6
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
$refmath[$ref]:::config -- "$ref->$ref" --o math
descriptionmath[description]:::config -- "description->description" --o math
$refsearch[$ref]:::config -- "$ref->$ref" --o search
descriptionsearch[description]:::config -- "description->description" --o search
messageinput7[message]:::config -- "message->message" --o input7
expressionjsonata8[expression]:::config -- "expression->expression" --o jsonata8
rawjsonata8[raw]:::config -- "raw->raw" --o jsonata8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```