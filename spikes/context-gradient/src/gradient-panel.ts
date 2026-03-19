/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gradient Panel — left sidebar UI for controlling generation.
 *
 * Contains: objective input, gradient level tabs, context textarea,
 * collapsible skill editor, and generate/generate-all buttons.
 */

import {
  GRADIENT_LEVELS,
  DEFAULT_OBJECTIVE,
  loadSkill,
  loadPersona,
} from "./prompts.js";
import { generate } from "./pipeline.js";
import { AppFrame } from "./app-frame.js";
import { formatPropertiesForPrompt } from "./data.js";
import type { DataMode } from "./data.js";

export { GradientPanel };

class GradientPanel {
  #container: HTMLElement;
  #appFrame: AppFrame;
  #selectedLevel: string = "L0";
  #contexts: Map<string, string> = new Map();
  #skill: string = "";
  #generating: Set<string> = new Set();
  #dataMode: DataMode = "rich";
  #dataset: string;
  #persona: string = "";

  constructor(container: HTMLElement, appFrame: AppFrame) {
    this.#container = container;
    this.#appFrame = appFrame;
    this.#dataset = formatPropertiesForPrompt(this.#dataMode);

    // Initialize contexts from defaults.
    for (const level of GRADIENT_LEVELS) {
      this.#contexts.set(level.id, level.context);
    }

    this.#init();
  }

  async #init() {
    // Load skill and persona files.
    try {
      const [skill, persona] = await Promise.all([loadSkill(), loadPersona()]);
      this.#skill = skill;
      this.#persona = persona;
    } catch {
      this.#skill = "// Failed to load skill.md";
      this.#persona = "";
    }

    this.#render();
  }

  #render() {
    this.#container.innerHTML = "";

    // Header
    const header = el("div", "panel-header");
    header.innerHTML = `
      <h1>Context Gradient</h1>
      <p class="subtitle">How personal context transforms generated UI</p>
    `;
    this.#container.appendChild(header);

    // Objective
    const objectiveSection = el("div", "panel-section");
    objectiveSection.innerHTML = `<label class="section-label">Objective</label>`;
    const objectiveInput = el("input", "objective-input") as HTMLInputElement;
    objectiveInput.type = "text";
    objectiveInput.value = DEFAULT_OBJECTIVE;
    objectiveInput.id = "objective-input";
    objectiveSection.appendChild(objectiveInput);
    this.#container.appendChild(objectiveSection);

    // Gradient level tabs
    const tabSection = el("div", "panel-section");
    tabSection.innerHTML = `<label class="section-label">Context Level</label>`;
    const tabs = el("div", "level-tabs");
    for (const level of GRADIENT_LEVELS) {
      const tab = el("button", "level-tab");
      tab.textContent = level.label;
      tab.title = level.name;
      tab.dataset.level = level.id;
      if (level.id === this.#selectedLevel) tab.classList.add("active");

      const dot = el("span", "tab-dot");
      if (this.#appFrame.hasCode(level.id)) dot.classList.add("generated");
      if (this.#generating.has(level.id)) dot.classList.add("generating");
      tab.prepend(dot);

      tab.addEventListener("click", () => this.#selectLevel(level.id));
      tabs.appendChild(tab);
    }
    tabSection.appendChild(tabs);

    // Level name
    const selectedLevel = GRADIENT_LEVELS.find(
      (l) => l.id === this.#selectedLevel
    )!;
    const levelName = el("div", "level-name");
    levelName.textContent = `${selectedLevel.id}: ${selectedLevel.name}`;
    tabSection.appendChild(levelName);

    this.#container.appendChild(tabSection);

    // Context textarea
    const contextSection = el("div", "panel-section context-section");
    contextSection.innerHTML = `<label class="section-label">Personal Context</label>`;
    const contextArea = el(
      "textarea",
      "context-textarea"
    ) as HTMLTextAreaElement;
    contextArea.id = "context-textarea";
    contextArea.value = this.#contexts.get(this.#selectedLevel) ?? "";
    contextArea.placeholder =
      this.#selectedLevel === "L0"
        ? "(No personal context at L0 — bare objective only)"
        : "Enter personal context…";
    contextArea.rows = 8;
    contextArea.addEventListener("input", () => {
      this.#contexts.set(this.#selectedLevel, contextArea.value);
    });
    contextSection.appendChild(contextArea);
    this.#container.appendChild(contextSection);

    // Data mode toggle (raw vs rich)
    const dataSection = el("div", "panel-section");
    dataSection.innerHTML = `<label class="section-label">Data Richness</label>`;
    const dataToggle = el("div", "data-toggle");
    for (const mode of ["raw", "rich"] as DataMode[]) {
      const btn = el("button", "data-btn");
      btn.textContent =
        mode === "raw" ? "Raw (lat/lng only)" : "Rich (pre-computed)";
      if (this.#dataMode === mode) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this.#dataMode = mode;
        this.#dataset = formatPropertiesForPrompt(mode);
        this.#render();
      });
      dataToggle.appendChild(btn);
    }
    dataSection.appendChild(dataToggle);
    this.#container.appendChild(dataSection);

    // Skill editor (collapsible)
    const skillSection = el("div", "panel-section");
    const skillToggle = el("button", "skill-toggle");
    skillToggle.innerHTML = `
      <span class="material-symbols-outlined">tune</span>
      <span>UI Skill</span>
      <span class="material-symbols-outlined chevron">expand_more</span>
    `;
    let skillExpanded = false;
    const skillArea = el(
      "textarea",
      "skill-textarea hidden"
    ) as HTMLTextAreaElement;
    skillArea.id = "skill-textarea";
    skillArea.value = this.#skill;
    skillArea.rows = 12;
    skillArea.addEventListener("input", () => {
      this.#skill = skillArea.value;
    });
    skillToggle.addEventListener("click", () => {
      skillExpanded = !skillExpanded;
      skillArea.classList.toggle("hidden", !skillExpanded);
      skillToggle.querySelector(".chevron")!.textContent = skillExpanded
        ? "expand_less"
        : "expand_more";
    });
    skillSection.appendChild(skillToggle);
    skillSection.appendChild(skillArea);
    this.#container.appendChild(skillSection);

    // Action buttons
    const actions = el("div", "panel-actions");

    const genBtn = el<HTMLButtonElement>("button", "btn btn-primary");
    genBtn.id = "generate-btn";
    genBtn.textContent = `Generate ${this.#selectedLevel}`;
    genBtn.disabled = this.#generating.has(this.#selectedLevel);
    genBtn.addEventListener("click", () => this.#generate(this.#selectedLevel));
    actions.appendChild(genBtn);

    const genAllBtn = el<HTMLButtonElement>("button", "btn btn-secondary");
    genAllBtn.id = "generate-all-btn";
    genAllBtn.textContent = "Generate All";
    genAllBtn.disabled = this.#generating.size > 0;
    genAllBtn.addEventListener("click", () => this.#generateAll());
    actions.appendChild(genAllBtn);

    this.#container.appendChild(actions);
  }

  #selectLevel(levelId: string) {
    this.#selectedLevel = levelId;
    this.#render();
  }

  async #generate(levelId: string) {
    if (this.#generating.has(levelId)) return;

    const objective =
      (document.getElementById("objective-input") as HTMLInputElement)?.value ??
      DEFAULT_OBJECTIVE;
    const context = this.#contexts.get(levelId) ?? "";

    this.#generating.add(levelId);
    this.#appFrame.showLoading(levelId);
    this.#render();

    try {
      const result = await generate({
        objective,
        context,
        skill: this.#skill,
        persona: this.#persona,
        dataset: this.#dataset,
        onThought: (text) => {
          this.#appFrame.appendStreamText(levelId, text);
        },
      });
      await this.#appFrame.renderCode(levelId, result.code);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#appFrame.showError(levelId, message);
    } finally {
      this.#generating.delete(levelId);
      this.#render();
    }
  }

  async #generateAll() {
    const objective =
      (document.getElementById("objective-input") as HTMLInputElement)?.value ??
      DEFAULT_OBJECTIVE;

    const promises = GRADIENT_LEVELS.map((level) => {
      if (this.#generating.has(level.id)) return Promise.resolve();

      this.#generating.add(level.id);
      this.#appFrame.showLoading(level.id);

      return generate({
        objective,
        context: this.#contexts.get(level.id) ?? "",
        skill: this.#skill,
        persona: this.#persona,
        dataset: this.#dataset,
        onThought: (text) => {
          this.#appFrame.appendStreamText(level.id, text);
        },
      })
        .then((result) => this.#appFrame.renderCode(level.id, result.code))
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          this.#appFrame.showError(level.id, message);
        })
        .finally(() => {
          this.#generating.delete(level.id);
          this.#render();
        });
    });

    this.#render();
    await Promise.allSettled(promises);
  }
}

/** Shorthand element creator. */
function el<T extends HTMLElement>(tag: string, className?: string): T {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element as T;
}
