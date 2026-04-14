/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const form = document.createElement("form");
form.style.maxWidth = "600px";
form.style.margin = "2rem auto";
form.style.display = "flex";
form.style.gap = "1rem";
form.style.fontFamily = "Inter, sans-serif";

const input = document.createElement("input");
input.type = "text";
input.placeholder = "Enter task objective...";
input.style.flex = "1";
input.style.padding = "0.75rem 1rem";
input.style.borderRadius = "8px";
input.style.border = "1px solid #e2e8f0";
input.style.fontSize = "1rem";

const button = document.createElement("button");
button.type = "submit";
button.textContent = "Create Task";
button.style.padding = "0.75rem 1.5rem";
button.style.borderRadius = "8px";
button.style.border = "none";
button.style.background = "#6366f1";
button.style.color = "#ffffff";
button.style.fontWeight = "600";
button.style.cursor = "pointer";
button.style.fontSize = "1rem";

form.appendChild(input);
form.appendChild(button);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const objective = input.value.trim();
  if (!objective) return;

  try {
    const response = await fetch("/folio/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ objective }),
    });
    const data = await response.json();
    console.log("Task created:", data);
    input.value = "";
  } catch (err) {
    console.error("Failed to create task:", err);
  }
});

document.body.appendChild(form);
