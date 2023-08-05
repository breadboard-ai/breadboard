# react-with-jsonata
  - Original: [`react-with-jsonata.ts`](../../src/boards/react-with-jsonata.ts)
  - Graph: [`react-with-jsonata.json`](../../graphs/react-with-jsonata.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
reflect4["reflect id='reflect-4'"] -- "graph->json" --> jsonata2["jsonata id='jsonata-2'"]
reflect4["reflect id='reflect-4'"] -- "graph->json" --> jsonata3["jsonata id='jsonata-3'"]
jsonata3["jsonata id='jsonata-3'"] -- "result->descriptions" --o promptTemplate5["promptTemplate id='promptTemplate-5'"]
jsonata2["jsonata id='jsonata-2'"] -- "result->tools" --o promptTemplate5["promptTemplate id='promptTemplate-5'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate id='promptTemplate-5'"]
rememberThought["append id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append id='rememberObservation'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate id='promptTemplate-5'"]
input6[/"input id='input-6'"/]:::input -- "text->Question" --> rememberQuestion["append id='rememberQuestion'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion id='react-completion'"]
math[["include id='math'"]]:::include -- "text->Observation" --> rememberObservation["append id='rememberObservation'"]
search[["include id='search'"]]:::include -- "text->Observation" --> rememberObservation["append id='rememberObservation'"]
jsonata7["jsonata id='jsonata-7'"] -- "search->text" --> search[["include id='search'"]]:::include
jsonata7["jsonata id='jsonata-7'"] -- "math->text" --> math[["include id='math'"]]:::include
jsonata7["jsonata id='jsonata-7'"] -- "answer->text" --> output8{{"output id='output-8'"}}:::output
reactcompletion["textCompletion id='react-completion'"] -- "completion->json" --> jsonata7["jsonata id='jsonata-7'"]
reactcompletion["textCompletion id='react-completion'"] -- "completion->Thought" --> rememberThought["append id='rememberThought'"]
promptTemplate5["promptTemplate id='promptTemplate-5'"] -- "prompt->text" --> reactcompletion["textCompletion id='react-completion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
expressionjsonata2[expression]:::config -- "expression->expression" --o jsonata2
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
templatepromptTemplate5[template]:::config -- "template->template" --o promptTemplate5
messageinput6[message]:::config -- "message->message" --o input6
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
$refmath[$ref]:::config -- "$ref->$ref" --o math
descriptionmath[description]:::config -- "description->description" --o math
$refsearch[$ref]:::config -- "$ref->$ref" --o search
descriptionsearch[description]:::config -- "description->description" --o search
expressionjsonata7[expression]:::config -- "expression->expression" --o jsonata7
rawjsonata7[raw]:::config -- "raw->raw" --o jsonata7
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```