# math
  - Original: [`math.ts`](../../src/boards/math.ts)
  - Graph: [`math.json`](../../graphs/math.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
compute["runJavascript id='compute'"] -- "result->text" --> print{{"output id='print'"}}:::output
mathfunctioncompletion["textCompletion id='math-function-completion'"] -- "completion->code" --> compute["runJavascript id='compute'"]
secrets1("secrets id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --> mathfunctioncompletion["textCompletion id='math-function-completion'"]
mathfunction["promptTemplate id='math-function'"] -- "prompt->text" --> mathfunctioncompletion["textCompletion id='math-function-completion'"]
mathquestion[/"input id='math-question'"/]:::input -- "text->question" --> mathfunction["promptTemplate id='math-function'"]
messagemathquestion[message]:::config -- "message->message" --o mathquestion
templatemathfunction[template]:::config -- "template->template" --o mathfunction
namecompute[name]:::config -- "name->name" --o compute
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```