# call-react-with-lambdas
  - Original: [`call-react-with-lambdas.ts`](../../src/boards/call-react-with-lambdas.ts)
  - Graph: [`call-react-with-lambdas.json`](../../graphs/call-react-with-lambdas.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
invoke1["invoke <br> id='invoke-1'"] -- "text->text" --> reactResponse{{"output <br> id='reactResponse'"}}:::output
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->text" --> invoke1["invoke <br> id='invoke-1'"]
schemauserRequest[schema]:::config -- "schema->schema" --o userRequest
pathinvoke1[path]:::config -- "path->path" --o invoke1
toolsinvoke1[tools]:::config -- "tools->tools" --o invoke1
schemareactResponse[schema]:::config -- "schema->schema" --o reactResponse
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```