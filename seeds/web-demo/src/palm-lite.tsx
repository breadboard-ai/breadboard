import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { palm, Chat, Text } from "@google-labs/palm-lite";

const promptOutput = signal("");
const embeddingOutput = signal("");
const chatOutput = signal("");

const call = async (apiKey: string, promptMessage: string) => {
  await transform(apiKey, promptMessage);
  await chat(apiKey, promptMessage);
  await embedding(apiKey, promptMessage);
}

const transform = async (apiKey: string, promptMessage: string) => {
  const text = new Text();
  text.text(promptMessage);

  const request = palm(apiKey).text(text);
  const data = await fetch(request);
  const response = await data.json();

  promptOutput.value = response.candidates[0].output;
}

const chat = async (apiKey: string, promptMessage: string) => {
  const chat = new Chat();
  chat.context("You are a pirate. Reply in a distinct pirate voice.")
    .addMessage(promptMessage);

  const request = palm(apiKey).message(chat);
  const data = await fetch(request);
  const response = await data.json();

  chatOutput.value = response.candidates[0].content;
}

const embedding = async (apiKey: string, text: string) => {
  const request = palm(apiKey).embedding({ text });
  const data = await fetch(request);
  const response = await data.json();

  embeddingOutput.value = response.embedding.value;
}

export function PalmLiteApp() {
  const promptRef = useRef();
  const apiKeyRef = useRef();
  return (
    <>
      <h1>Palm lite</h1>
      <div class="card">
        <label for="apikey" >API key</label>
        <input id="apikey" type="text" ref={apiKeyRef} placeholder="API key" />
      </div>

      <div class="card">
        <label for="prompt">Prompt</label>
        <textarea id="prompt" ref={promptRef} placeholder="Enter text here"></textarea>
      </div>

      <div class="card output">
        <label>Prompt Output</label>
        <div id="output">{promptOutput}</div>
      </div>

      <div class="card output">
        <label>Chat Output (pirate)</label>
        <div id="output" style="overflow-x: auto;">{chatOutput}</div>
      </div>

      <div class="card output">
        <label>Embedding Output</label>
        <div id="output" style="overflow-x: auto;">{embeddingOutput}</div>
      </div>

      <button class="primary" onClick={() => { call(apiKeyRef.current.value, promptRef.current.value) }
      }>Go.</button>
    </>
  )
}