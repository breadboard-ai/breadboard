# endless-debate
  - Original: [`endless-debate.ts`](../../src/boards/endless-debate.ts)
  - Graph: [`endless-debate.json`](../../graphs/endless-debate.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberAlbert["append id='rememberAlbert'"]
rememberAlbert["append id='rememberAlbert'"] -- "accumulator->accumulator" --> rememberFriedrich["append id='rememberFriedrich'"]
rememberFriedrich["append id='rememberFriedrich'"] -- "accumulator->accumulator" --> rememberAlbert["append id='rememberAlbert'"]
rememberAlbert["append id='rememberAlbert'"] -- "accumulator->context" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
textCompletion3["textCompletion id='textCompletion-3'"] -- "completion->Albert" --> rememberAlbert["append id='rememberAlbert'"]
textCompletion3["textCompletion id='textCompletion-3'"] -- "completion->text" --> output4{{"output id='output-4'"}}:::output
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion3["textCompletion id='textCompletion-3'"]
albert["promptTemplate id='albert'"] -- "prompt->text" --> textCompletion3["textCompletion id='textCompletion-3'"]
rememberFriedrich["append id='rememberFriedrich'"] -- "accumulator->context" --> albert["promptTemplate id='albert'"]
textCompletion5["textCompletion id='textCompletion-5'"] -- "completion->Friedrich" --> rememberFriedrich["append id='rememberFriedrich'"]
textCompletion5["textCompletion id='textCompletion-5'"] -- "completion->text" --> output6{{"output id='output-6'"}}:::output
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion5["textCompletion id='textCompletion-5'"]
promptTemplate2["promptTemplate id='promptTemplate-2'"] -- "prompt->text" --> textCompletion5["textCompletion id='textCompletion-5'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->context" --> albert["promptTemplate id='albert'"]
input7[/"input id='input-7'"/]:::input -- "text->topic" --> rememberQuestion["append id='rememberQuestion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextCompletion3[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion3
stopsequencestextCompletion5[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion5
messageinput7[message]:::config -- "message->message" --o input7
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```