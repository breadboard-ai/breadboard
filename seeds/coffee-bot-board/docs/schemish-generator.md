# Coffee Bot graph for schemish-generator.json

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "prologue->prologue" --> prologue(("passthrough <br> id='prologue'")):::passthrough
input1[/"input <br> id='input-1'"/]:::input -- "epilogue->epilogue" --> epilogue(("passthrough <br> id='epilogue'")):::passthrough
input1[/"input <br> id='input-1'"/]:::input -- "schema->schema" --> schema(("passthrough <br> id='schema'")):::passthrough
schema(("passthrough <br> id='schema'")):::passthrough -- "schema->schema" --> schemish["schemish <br> id='schemish'"]
validatejson["validateJson <br> id='validate-json'"] -- "json->completion" --> completion{{"output <br> id='completion'"}}:::output
validatejson["validateJson <br> id='validate-json'"] -- "error->error" --> error{{"output <br> id='error'"}}:::output
schema(("passthrough <br> id='schema'")):::passthrough -- "schema->schema" --> validatejson["validateJson <br> id='validate-json'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o generator["generateText <br> id='generator'"]
generator["generateText <br> id='generator'"] -- "completion->json" --> validatejson["validateJson <br> id='validate-json'"]
generator["generateText <br> id='generator'"] -- "filters->error" --> error{{"output <br> id='error'"}}:::output
prologue(("passthrough <br> id='prologue'")):::passthrough -- "prologue->prologue" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
epilogue(("passthrough <br> id='epilogue'")):::passthrough -- "epilogue->epilogue" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
schemish["schemish <br> id='schemish'"] -- "schemish->schemish" --> schemishGenerator["promptTemplate <br> id='schemishGenerator'"]
schemishGenerator["promptTemplate <br> id='schemishGenerator'"] -- "prompt->text" --> generator["generateText <br> id='generator'"]
stopSequencesgenerator[stopSequences]:::config -- "stopSequences->stopSequences" --o generator
safetySettingsgenerator[safetySettings]:::config -- "safetySettings->safetySettings" --o generator
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
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