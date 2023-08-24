# Coffee Bot graph for schemish-generator.json

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "prologue->prologue" --> prologue(("passthrough <br> id='prologue'")):::passthrough
input1[/"input <br> id='input-1'"/]:::input -- "epilogue->epilogue" --> epilogue(("passthrough <br> id='epilogue'")):::passthrough
input1[/"input <br> id='input-1'"/]:::input -- "schema->schema" --> schema(("passthrough <br> id='schema'")):::passthrough
error(("passthrough <br> id='error'")):::passthrough -- "error->error" --> output2{{"output <br> id='output-2'"}}:::output
completion(("passthrough <br> id='completion'")):::passthrough -- "completion->completion" --> output2{{"output <br> id='output-2'"}}:::output
schema(("passthrough <br> id='schema'")):::passthrough -- "schema->schema" --> schemish(("passthrough <br> id='schemish'")):::passthrough
validateJSON["validateJson <br> id='validateJSON'"] -- "json->json" --> completion(("passthrough <br> id='completion'")):::passthrough
validateJSON["validateJson <br> id='validateJSON'"] -- "error->error" --> error(("passthrough <br> id='error'")):::passthrough
schema(("passthrough <br> id='schema'")):::passthrough -- "schema->schema" --> validateJSON["validateJson <br> id='validateJSON'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText3["generateText <br> id='generateText-3'"]
generateText3["generateText <br> id='generateText-3'"] -- "completion->completion" --> validateJSON["validateJson <br> id='validateJSON'"]
generateText3["generateText <br> id='generateText-3'"] -- "filters->error" --> error(("passthrough <br> id='error'")):::passthrough
prologue(("passthrough <br> id='prologue'")):::passthrough -- "prologue->prologue" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
epilogue(("passthrough <br> id='epilogue'")):::passthrough -- "epilogue->epilogue" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
schemish(("passthrough <br> id='schemish'")):::passthrough -- "schemish->schemish" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
schemishGenerator["promptTemplate <br> id='schemishGenerator'"] -- "prompt->text" --> generateText3["generateText <br> id='generateText-3'"]
stopSequencesgenerateText3[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText3
safetySettingsgenerateText3[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText3
keyssecrets4[keys]:::config -- "keys->keys" --o secrets4
templateschemishGenerator[template]:::config -- "template->template" --o schemishGenerator
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```