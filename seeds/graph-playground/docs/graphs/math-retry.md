# math-retry
  - Original: [`math-retry.ts`](../../src/boards/math-retry.ts)
  - Graph: [`math-retry.json`](../../graphs/math-retry.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
lambda2["lambda <br> id='lambda-2'"] -- "board->lambda" --> invoke1["invoke <br> id='invoke-1'"]
subgraph sg_lambda2 [lambda-2]
lambda2_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> lambda2_mathfunctiongenerator["generateText <br> id='math-function-generator'"]
lambda2_input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda2_mathfunctiongenerator["generateText <br> id='math-function-generator'"]
lambda2_mathfunctiongenerator["generateText <br> id='math-function-generator'"] -- "completion->code" --> lambda2_compute["runJavascript <br> id='compute'"]
lambda2_compute["runJavascript <br> id='compute'"] -- "result->text" --> lambda2_output2{{"output <br> id='output-2'"}}:::output
lambda2_compute["runJavascript <br> id='compute'"] -- "$error->$error" --> lambda2_passthrough4(("passthrough <br> id='passthrough-4'")):::passthrough
lambda2_mathfunctiongenerator["generateText <br> id='math-function-generator'"] -- "completion->completion" --> lambda2_passthrough4(("passthrough <br> id='passthrough-4'")):::passthrough
end
sg_lambda2:::slotted -- "lamdba->lamdba" --o lambda2

invoke1["invoke <br> id='invoke-1'"] -- "text->text" --> print{{"output <br> id='print'"}}:::output
mathfunction["promptTemplate <br> id='math-function'"] -- "prompt->text" --> invoke1["invoke <br> id='invoke-1'"]
mathquestion[/"input <br> id='math-question'"/]:::input -- "text->question" --> mathfunction["promptTemplate <br> id='math-function'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```