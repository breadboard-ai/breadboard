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
id='jsonata-4'"] -- "result->descriptions" --o prompttemplate6["prompt-template
id='prompt-template-6'"]
jsonata3["jsonata
id='jsonata-3'"] -- "result->tools" --o prompttemplate6["prompt-template
id='prompt-template-6'"]
localmemory2["local-memory
id='local-memory-2'"] -- "context->memory" --> prompttemplate6["prompt-template
id='prompt-template-6'"]
secrets1("secrets
id='secrets-1'"):::secrets -- "API_KEY->API_KEY" --o reactcompletion["text-completion
id='react-completion'"]
math[["include
id='math'"]]:::include -- "text->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
search[["include
id='search'"]]:::include -- "text->Observation" --> localmemory2["local-memory
id='local-memory-2'"]
jsonata8["jsonata
id='jsonata-8'"] -- "search->text" --> search[["include
id='search'"]]:::include
jsonata8["jsonata
id='jsonata-8'"] -- "math->text" --> math[["include
id='math'"]]:::include
jsonata8["jsonata
id='jsonata-8'"] -- "answer->text" --> output9{{"output
id='output-9'"}}:::output
reactcompletion["text-completion
id='react-completion'"] -- "completion->json" --> jsonata8["jsonata
id='jsonata-8'"]
reactcompletion["text-completion
id='react-completion'"] -- "completion->Thought" --> rememberthought["local-memory
id='remember-thought'"]
prompttemplate6["prompt-template
id='prompt-template-6'"] -- "prompt->text" --> reactcompletion["text-completion
id='react-completion'"]
rememberquestion["local-memory
id='remember-question'"] -- "context->memory" --> prompttemplate6["prompt-template
id='prompt-template-6'"]
input7[/"input
id='input-7'"/]:::input -- "text->Question" --> rememberquestion["local-memory
id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
templateprompttemplate6[template]:::config -- "template->template" --o prompttemplate6
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