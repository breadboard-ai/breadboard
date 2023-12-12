## text-generator.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input[/"input <br> id='input'"/]:::input -- "useStreaming->useStreaming" --> gemini["invoke <br> id='gemini'"]
input[/"input <br> id='input'"/]:::input -- "text->text" --> gemini["invoke <br> id='gemini'"]
gemini["invoke <br> id='gemini'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
gemini["invoke <br> id='gemini'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText1["palm-generateText <br> id='palm-generateText-1'"]
input[/"input <br> id='input'"/]:::input -- "MODEL->MODEL" --> switchModel["runJavascript <br> id='switchModel'"]
input[/"input <br> id='input'"/]:::input -- "useStreaming->useStreaming" --> switchModel["runJavascript <br> id='switchModel'"]
input[/"input <br> id='input'"/]:::input -- "useStreaming->useStreaming" --> gpt35["invoke <br> id='gpt35'"]
gpt35["invoke <br> id='gpt35'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
input[/"input <br> id='input'"/]:::input -- "text->text" --> gpt35["invoke <br> id='gpt35'"]
gpt35["invoke <br> id='gpt35'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
palmgenerateText1["palm-generateText <br> id='palm-generateText-1'"] -- "completion->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
input[/"input <br> id='input'"/]:::input -- "text->text" --> palmgenerateText1["palm-generateText <br> id='palm-generateText-1'"]
input[/"input <br> id='input'"/]:::input -- "useStreaming->useStreaming" --> mockModel["runJavascript <br> id='mockModel'"]
mockModel["runJavascript <br> id='mockModel'"] -- "text->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
input[/"input <br> id='input'"/]:::input -- "text->text" --> mockModel["runJavascript <br> id='mockModel'"]
switchModel["runJavascript <br> id='switchModel'"] -- "other->text" --> textOutput{{"output <br> id='textOutput'"}}:::output
switchModel["runJavascript <br> id='switchModel'"] -- "gemini->gemini" --> gemini["invoke <br> id='gemini'"]
switchModel["runJavascript <br> id='switchModel'"] -- "palm->palm" --> palmgenerateText1["palm-generateText <br> id='palm-generateText-1'"]
switchModel["runJavascript <br> id='switchModel'"] -- "gpt35->gpt35" --> gpt35["invoke <br> id='gpt35'"]
switchModel["runJavascript <br> id='switchModel'"] -- "mock->mock" --> mockModel["runJavascript <br> id='mockModel'"]
mockModel["runJavascript <br> id='mockModel'"] -- "list->list" --> listToStream3["listToStream <br> id='listToStream-3'"]
listToStream3["listToStream <br> id='listToStream-3'"] -- "stream->stream" --> streamOutput{{"output <br> id='streamOutput'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```