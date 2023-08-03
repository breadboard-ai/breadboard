# endless-debate-with-voice
  - Original: [`endless-debate-with-voice.ts`](../../src/boards/endless-debate-with-voice.ts)
  - Graph: [`endless-debate-with-voice.json`](../../graphs/endless-debate-with-voice.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
localMemory5["localMemory id='localMemory-5'"] -- "context->context" --> promptTemplate3["promptTemplate id='promptTemplate-3'"]
textCompletion4["textCompletion id='textCompletion-4'"] -- "completion->Albert" --> localMemory5["localMemory id='localMemory-5'"]
secrets2("secrets id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion6["textCompletion id='textCompletion-6'"]
textCompletion6["textCompletion id='textCompletion-6'"] -- "completion->text" --> output7{{"output id='output-7'"}}:::output
albertvoice["promptTemplate id='albert-voice'"] -- "prompt->text" --> textCompletion6["textCompletion id='textCompletion-6'"]
textCompletion4["textCompletion id='textCompletion-4'"] -- "completion->context" --> albertvoice["promptTemplate id='albert-voice'"]
secrets2("secrets id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion4["textCompletion id='textCompletion-4'"]
albert["promptTemplate id='albert'"] -- "prompt->text" --> textCompletion4["textCompletion id='textCompletion-4'"]
localMemory9["localMemory id='localMemory-9'"] -- "context->context" --> albert["promptTemplate id='albert'"]
textCompletion8["textCompletion id='textCompletion-8'"] -- "completion->Friedrich" --> localMemory9["localMemory id='localMemory-9'"]
secrets2("secrets id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion10["textCompletion id='textCompletion-10'"]
textCompletion10["textCompletion id='textCompletion-10'"] -- "completion->text" --> output11{{"output id='output-11'"}}:::output
friedrichvoice["promptTemplate id='friedrich-voice'"] -- "prompt->text" --> textCompletion10["textCompletion id='textCompletion-10'"]
textCompletion8["textCompletion id='textCompletion-8'"] -- "completion->context" --> friedrichvoice["promptTemplate id='friedrich-voice'"]
secrets2("secrets id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion8["textCompletion id='textCompletion-8'"]
promptTemplate3["promptTemplate id='promptTemplate-3'"] -- "prompt->text" --> textCompletion8["textCompletion id='textCompletion-8'"]
localMemory1["localMemory id='localMemory-1'"] -- "context->context" --> albert["promptTemplate id='albert'"]
input12[/"input id='input-12'"/]:::input -- "text->topic" --> localMemory1["localMemory id='localMemory-1'"]
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextCompletion4[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion4
templatealbertvoice[template]:::config -- "template->template" --o albertvoice
stopsequencestextCompletion8[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion8
templatefriedrichvoice[template]:::config -- "template->template" --o friedrichvoice
messageinput12[message]:::config -- "message->message" --o input12
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```