# react-with-slot
  - Original: [`react-with-slot.ts`](../../src/boards/react-with-slot.ts)
  - Graph: [`react-with-slot.json`](../../graphs/react-with-slot.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getslot(("slot id='get-slot'")):::slot -- "graph->json" --> jsonata2["jsonata id='jsonata-2'"]
getslot(("slot id='get-slot'")):::slot -- "graph->json" --> jsonata3["jsonata id='jsonata-3'"]
jsonata3["jsonata id='jsonata-3'"] -- "result->descriptions" --o promptTemplate4["promptTemplate id='promptTemplate-4'"]
jsonata2["jsonata id='jsonata-2'"] -- "result->tools" --o promptTemplate4["promptTemplate id='promptTemplate-4'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate4["promptTemplate id='promptTemplate-4'"]
rememberThought["append id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append id='rememberObservation'"]
rememberObservation["append id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append id='rememberThought'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate4["promptTemplate id='promptTemplate-4'"]
input5[/"input id='input-5'"/]:::input -- "text->Question" --> rememberQuestion["append id='rememberQuestion'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion id='react-completion'"]
toolsslot(("slot id='tools-slot'")):::slot -- "text->Observation" --> rememberObservation["append id='rememberObservation'"]
jsonata6["jsonata id='jsonata-6'"] -- all --> toolsslot(("slot id='tools-slot'")):::slot
jsonata6["jsonata id='jsonata-6'"] -- "answer->text" --> output7{{"output id='output-7'"}}:::output
reactcompletion["textCompletion id='react-completion'"] -- "completion->json" --> jsonata6["jsonata id='jsonata-6'"]
reactcompletion["textCompletion id='react-completion'"] -- "completion->Thought" --> rememberThought["append id='rememberThought'"]
promptTemplate4["promptTemplate id='promptTemplate-4'"] -- "prompt->text" --> reactcompletion["textCompletion id='react-completion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
slotgetslot[slot]:::config -- "slot->slot" --o getslot
graphgetslot[graph]:::config -- "graph->graph" --o getslot
expressionjsonata2[expression]:::config -- "expression->expression" --o jsonata2
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
templatepromptTemplate4[template]:::config -- "template->template" --o promptTemplate4
accumulatorrememberQuestion[accumulator]:::config -- "accumulator->accumulator" --o rememberQuestion
messageinput5[message]:::config -- "message->message" --o input5
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
expressionjsonata6[expression]:::config -- "expression->expression" --o jsonata6
rawjsonata6[raw]:::config -- "raw->raw" --o jsonata6
slottoolsslot[slot]:::config -- "slot->slot" --o toolsslot
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```