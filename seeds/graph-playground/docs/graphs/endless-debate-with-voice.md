# endless-debate-with-voice
  - Original: [`endless-debate-with-voice.ts`](../../src/boards/endless-debate-with-voice.ts)
  - Graph: [`endless-debate-with-voice.json`](../../graphs/endless-debate-with-voice.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberAlbert["append id='rememberAlbert'"]
rememberAlbert["append id='rememberAlbert'"] -- "accumulator->accumulator" --> rememberFriedrich["append id='rememberFriedrich'"]
rememberFriedrich["append id='rememberFriedrich'"] -- "accumulator->accumulator" --> rememberAlbert["append id='rememberAlbert'"]
rememberAlbert["append id='rememberAlbert'"] -- "accumulator->context" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
textCompletion3["textCompletion id='textCompletion-3'"] -- "completion->Albert" --> rememberAlbert["append id='rememberAlbert'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion4["textCompletion id='textCompletion-4'"]
textCompletion4["textCompletion id='textCompletion-4'"] -- "completion->text" --> output5{{"output id='output-5'"}}:::output
albertvoice["promptTemplate id='albert-voice'"] -- "prompt->text" --> textCompletion4["textCompletion id='textCompletion-4'"]
textCompletion3["textCompletion id='textCompletion-3'"] -- "completion->context" --> albertvoice["promptTemplate id='albert-voice'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion3["textCompletion id='textCompletion-3'"]
albert["promptTemplate id='albert'"] -- "prompt->text" --> textCompletion3["textCompletion id='textCompletion-3'"]
rememberFriedrich["append id='rememberFriedrich'"] -- "accumulator->context" --> albert["promptTemplate id='albert'"]
textCompletion6["textCompletion id='textCompletion-6'"] -- "completion->Friedrich" --> rememberFriedrich["append id='rememberFriedrich'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion7["textCompletion id='textCompletion-7'"]
textCompletion7["textCompletion id='textCompletion-7'"] -- "completion->text" --> output8{{"output id='output-8'"}}:::output
friedrichvoice["promptTemplate id='friedrich-voice'"] -- "prompt->text" --> textCompletion7["textCompletion id='textCompletion-7'"]
textCompletion6["textCompletion id='textCompletion-6'"] -- "completion->context" --> friedrichvoice["promptTemplate id='friedrich-voice'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion6["textCompletion id='textCompletion-6'"]
promptTemplate2["promptTemplate id='promptTemplate-2'"] -- "prompt->text" --> textCompletion6["textCompletion id='textCompletion-6'"]
rememberQuestion["append id='rememberQuestion'"] -- "accumulator->context" --> albert["promptTemplate id='albert'"]
input9[/"input id='input-9'"/]:::input -- "text->topic" --> rememberQuestion["append id='rememberQuestion'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextCompletion3[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion3
templatealbertvoice[template]:::config -- "template->template" --o albertvoice
stopsequencestextCompletion6[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion6
templatefriedrichvoice[template]:::config -- "template->template" --o friedrichvoice
messageinput9[message]:::config -- "message->message" --o input9
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```