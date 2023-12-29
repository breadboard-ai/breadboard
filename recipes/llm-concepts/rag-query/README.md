# RAG Query

This recipe demonstrates how to integrate RAG into a Breadboard application. It doesn't use any specific APIs, rather it orchestrates the data flow between a number of different APIs

## Compiling the recipe

`breadboard make recipes/llm-concepts/rag-query/index.js > recipes/llm-concepts/rag-query/index.json`

## Running the Recipe

### Inputs

- `query` - The query that you want to search for
- `embeddingBoardPath` - the path to a board that accepts a `query` and returns an `embedding`
- `ragBoardPath` - the path to a board that accepts an `embedding` and returns a `candidate`
- `generateTextBoardPath` - the path to a board that accepts `text` and returns `text`

### Secrets

This recipe may require secrets to be set for the APIs that the embedding, rag, and generateText boards.

### Outputs

- `text` - The output text from the query that was searched for along with the additional context provided by the RAG model

### From the CLI

This board requires a lot of input boards, so it's easier to test from the repository.

```bash
breadboard run recipes/llm-concepts/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"query\":\"Testing\"}"
```

### From the UI

```bash
breadboard debug recipes/use-case/generate-embedding/index.js
```

### Testing from the CLI

Because this board requires a lot of input boards, you can test this directly from the repository by running the following commands (note you need to have absolute paths to the boards):

```bash
breadboard run recipes/llm-concepts/rag-query/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"query\":\"Testing\", \"embeddingBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/embedding.json\",\"ragBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/retrieve.json\",\"generateTextBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/generate-text.json\"}"
```

JSON recipe:

```bash
breadboard run recipes/llm-concepts/rag-query/index.json --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"query\":\"Testing\", \"embeddingBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/embedding.json\",\"ragBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/retrieve.json\",\"generateTextBoardPath\":\"$(pwd)/recipes/llm-concepts/rag-query/test-harness/generate-text.json\"}"
```

## Code

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
generateText["invoke <br> id='generateText'"] -- all --> output{{"output <br> id='output'"}}:::output
input[/"input <br> id='input'"/]:::input -- "embeddingBoardPath->path" --> generateQueryEmbedding["invoke <br> id='generateQueryEmbedding'"]
input[/"input <br> id='input'"/]:::input -- "query->query" --> generateQueryEmbedding["invoke <br> id='generateQueryEmbedding'"]
input[/"input <br> id='input'"/]:::input -- "ragBoardPath->path" --> retrieveCandidateFromDataStore["invoke <br> id='retrieveCandidateFromDataStore'"]
input[/"input <br> id='input'"/]:::input -- "query->query" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
input[/"input <br> id='input'"/]:::input -- "generateTextBoardPath->path" --> generateText["invoke <br> id='generateText'"]
promptTemplate3["promptTemplate <br> id='promptTemplate-3'"] -- "text->text" --> generateText["invoke <br> id='generateText'"]
generateQueryEmbedding["invoke <br> id='generateQueryEmbedding'"] -- "embedding->embedding" --> retrieveCandidateFromDataStore["invoke <br> id='retrieveCandidateFromDataStore'"]
retrieveCandidateFromDataStore["invoke <br> id='retrieveCandidateFromDataStore'"] -- "candidate->candidate" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```
