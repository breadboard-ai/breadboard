# react-with-slot
  - Original: [`react-with-slot.ts`](../../src/boards/react-with-slot.ts)
  - Graph: [`react-with-slot.json`](../../graphs/react-with-slot.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getslot(("slot id='get-slot'")):::slot -- "graph->json" --> jsonata3["jsonata id='jsonata-3'"]
getslot(("slot id='get-slot'")):::slot -- "graph->json" --> jsonata4["jsonata id='jsonata-4'"]
jsonata4["jsonata id='jsonata-4'"] -- "result->descriptions" --o promptTemplate5["promptTemplate id='promptTemplate-5'"]
jsonata3["jsonata id='jsonata-3'"] -- "result->tools" --o promptTemplate5["promptTemplate id='promptTemplate-5'"]
localMemory2["localMemory id='localMemory-2'"] -- "context->memory" --> promptTemplate5["promptTemplate id='promptTemplate-5'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["textCompletion id='react-completion'"]
toolsslot(("slot id='tools-slot'")):::slot -- "text->Observation" --> localMemory2["localMemory id='localMemory-2'"]
jsonata7["jsonata id='jsonata-7'"] -- all --> toolsslot(("slot id='tools-slot'")):::slot
jsonata7["jsonata id='jsonata-7'"] -- "answer->text" --> output8{{"output id='output-8'"}}:::output
reactcompletion["textCompletion id='react-completion'"] -- "completion->json" --> jsonata7["jsonata id='jsonata-7'"]
reactcompletion["textCompletion id='react-completion'"] -- "completion->Thought" --> rememberthought["localMemory id='remember-thought'"]
promptTemplate5["promptTemplate id='promptTemplate-5'"] -- "prompt->text" --> reactcompletion["textCompletion id='react-completion'"]
rememberquestion["localMemory id='remember-question'"] -- "context->memory" --> promptTemplate5["promptTemplate id='promptTemplate-5'"]
input6[/"input id='input-6'"/]:::input -- "text->Question" --> rememberquestion["localMemory id='remember-question'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
slotgetslot[slot]:::config -- "slot->slot" --o getslot
graphgetslot[graph]:::config -- "graph->graph" --o getslot
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
templatepromptTemplate5[template]:::config -- "template->template" --o promptTemplate5
stopsequencesreactcompletion[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o reactcompletion
messageinput6[message]:::config -- "message->message" --o input6
expressionjsonata7[expression]:::config -- "expression->expression" --o jsonata7
rawjsonata7[raw]:::config -- "raw->raw" --o jsonata7
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