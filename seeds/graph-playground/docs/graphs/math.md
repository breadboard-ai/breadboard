# math
  ---
  - Original: [`math.ts`](../../src/boards/math.ts)
  - Graph: [`math.json`](../../graphs/math.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets
id='secrets-1'"):::secrets -- API_KEY:API_KEY --> mathfunctioncompletion["text-completion
id='math-function-completion'"]
compute["run-javascript
id='compute'"] -- result:text --> print{{"output
id='print'"}}:::output
mathfunctioncompletion["text-completion
id='math-function-completion'"] -- completion:code --> compute["run-javascript
id='compute'"]
mathfunction["prompt-template
id='math-function'"] -- prompt:text --> mathfunctioncompletion["text-completion
id='math-function-completion'"]
mathquestion[/"input
id='math-question'"/]:::input -- text:question --> mathfunction["prompt-template
id='math-function'"]
templatemathfunction[template]:::config -- template:template --o mathfunction
keyssecrets1[keys]:::config -- keys:keys --o secrets1
messagemathquestion[message]:::config -- message:message --o mathquestion
namecompute[name]:::config -- name:name --o compute
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```