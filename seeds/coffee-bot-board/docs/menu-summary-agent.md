# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
menu(("passthrough <br> id='menu'")):::passthrough -- "menu->menu" --o menuSummaryAgent["promptTemplate <br> id='menuSummaryAgent'"]
generateText2["generateText <br> id='generateText-2'"] -- "filters->error" --> error{{"output <br> id='error'"}}:::output
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText2["generateText <br> id='generateText-2'"]
formatOutput["runJavascript <br> id='formatOutput'"] -- "bot->bot" --> bot{{"output <br> id='bot'"}}:::output
generateText2["generateText <br> id='generateText-2'"] -- "completion->completion" --> formatOutput["runJavascript <br> id='formatOutput'"]
menuSummaryAgent["promptTemplate <br> id='menuSummaryAgent'"] -- "prompt->text" --> generateText2["generateText <br> id='generateText-2'"]
input1[/"input <br> id='input-1'"/]:::input -- "customer->customer" --> menuSummaryAgent["promptTemplate <br> id='menuSummaryAgent'"]
templatemenuSummaryAgent[template]:::config -- "template->template" --o menuSummaryAgent
menumenu[menu]:::config -- "menu->menu" --o menu
stopSequencesgenerateText2[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText2
keyssecrets3[keys]:::config -- "keys->keys" --o secrets3
nameformatOutput[name]:::config -- "name->name" --o formatOutput
codeformatOutput[code]:::config -- "code->code" --o formatOutput
rawformatOutput[raw]:::config -- "raw->raw" --o formatOutput
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```