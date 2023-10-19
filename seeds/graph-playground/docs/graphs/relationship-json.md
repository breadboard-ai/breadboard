# relationship-json
  - Original: [`relationship-json.ts`](../../src/boards/relationship-json.ts)
  - Graph: [`relationship-json.json`](../../graphs/relationship-json.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
lambda3["lambda <br> id='lambda-3'"] -- "board->lambda" --> invoke2["invoke <br> id='invoke-2'"]
subgraph sg_lambda3 [lambda-3]
lambda3_secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --o lambda3_generateText4["generateText <br> id='generateText-4'"]
lambda3_input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda3_generateText4["generateText <br> id='generateText-4'"]
lambda3_generateText4["generateText <br> id='generateText-4'"] -- "completion->json" --> lambda3_validateJson5["validateJson <br> id='validateJson-5'"]
lambda3_input1[/"input <br> id='input-1'"/]:::input -- "schema->schema" --> lambda3_validateJson5["validateJson <br> id='validateJson-5'"]
lambda3_validateJson5["validateJson <br> id='validateJson-5'"] -- "json->json" --> lambda3_runJavascript6["runJavascript <br> id='runJavascript-6'"]
lambda3_input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda3_runJavascript6["runJavascript <br> id='runJavascript-6'"]
lambda3_runJavascript6["runJavascript <br> id='runJavascript-6'"] -- "json->completion" --> lambda3_output2{{"output <br> id='output-2'"}}:::output
lambda3_generateText4["generateText <br> id='generateText-4'"] -- "completion->completion" --> lambda3_validateJson5["validateJson <br> id='validateJson-5'"]
lambda3_generateText4["generateText <br> id='generateText-4'"] -- "completion->completion" --> lambda3_runJavascript6["runJavascript <br> id='runJavascript-6'"]





end
sg_lambda3:::slotted -- "lamdba->lamdba" --o lambda3

invoke2["invoke <br> id='invoke-2'"] -- "completion->text" --> analysis{{"output <br> id='analysis'"}}:::output
promptTemplate1["promptTemplate <br> id='promptTemplate-1'"] -- "prompt->text" --> invoke2["invoke <br> id='invoke-2'"]
scene[/"input <br> id='scene'"/]:::input -- "text->scene" --> promptTemplate1["promptTemplate <br> id='promptTemplate-1'"]
schemascene[schema]:::config -- "schema->schema" --o scene
templatepromptTemplate1[template]:::config -- "template->template" --o promptTemplate1
schemapromptTemplate1[schema]:::config -- "schema->schema" --o promptTemplate1
pathinvoke2[path]:::config -- "path->path" --o invoke2

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