const BACKEND_URL = "http://localhost:8080";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <h1>Ark</h1>
  <button id="echo-btn">Echo</button>
  <pre id="result"></pre>
`;

const button = document.querySelector<HTMLButtonElement>("#echo-btn")!;
const result = document.querySelector<HTMLPreElement>("#result")!;

button.addEventListener("click", async () => {
  button.disabled = true;
  result.textContent = "…";
  try {
    const response = await fetch(`${BACKEND_URL}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello from ark" }),
    });
    const data = await response.json();
    result.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    result.textContent = `Error: ${error}`;
  } finally {
    button.disabled = false;
  }
});
