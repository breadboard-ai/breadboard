# relationship-json
  - Original: [`relationship-json.ts`](../../src/boards/relationship-json.ts)
  - Graph: [`relationship-json.json`](../../graphs/relationship-json.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
lambda1["lambda <br> id='lambda-1'"] -- "board->lambda" --> invoke3["invoke <br> id='invoke-3'"]
subgraph sg_lambda1 [lambda-1]
lambda1_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --o lambda1_generateText4["generateText <br> id='generateText-4'"]
lambda1_input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda1_generateText4["generateText <br> id='generateText-4'"]
lambda1_generateText4["generateText <br> id='generateText-4'"] -- "completion->json" --> lambda1_validateJson5["validateJson <br> id='validateJson-5'"]
lambda1_runJavascript6["runJavascript <br> id='runJavascript-6'"] -- "json->completion" --> lambda1_output2{{"output <br> id='output-2'"}}:::output
lambda1_validateJson5["validateJson <br> id='validateJson-5'"] -- "json->json" --> lambda1_runJavascript6["runJavascript <br> id='runJavascript-6'"]
lambda1_input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda1_runJavascript6["runJavascript <br> id='runJavascript-6'"]
lambda1_generateText4["generateText <br> id='generateText-4'"] -- "completion->completion" --> lambda1_jsonata7["jsonata <br> id='jsonata-7'"]
lambda1_input1[/"input <br> id='input-1'"/]:::input -- "schema->schema" --> lambda1_validateJson5["validateJson <br> id='validateJson-5'"]
lambda1_validateJson5["validateJson <br> id='validateJson-5'"] -- "error->error" --> lambda1_jsonata7["jsonata <br> id='jsonata-7'"]
lambda1_runJavascript6["runJavascript <br> id='runJavascript-6'"] -- "error->error" --> lambda1_jsonata7["jsonata <br> id='jsonata-7'"]







end
sg_lambda1:::slotted -- "lamdba->lamdba" --o lambda1

invoke3["invoke <br> id='invoke-3'"] -- "completion->text" --> analysis{{"output <br> id='analysis'"}}:::output
promptTemplate2["promptTemplate <br> id='promptTemplate-2'"] -- "prompt->text" --> invoke3["invoke <br> id='invoke-3'"]
scene[/"input <br> id='scene'"/]:::input -- "text->scene" --> promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]

schemascene[schema]:::config -- "schema->schema" --o scene
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
schemapromptTemplate2[schema]:::config -- "schema->schema" --o promptTemplate2
pathinvoke3[path]:::config -- "path->path" --o invoke3
schemaanalysis[schema]:::config -- "schema->schema" --o analysis
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```