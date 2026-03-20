/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Refinement Panel — left sidebar for setup and telemetry.
 *
 * Chat and feedback have moved to the ChatStrip below the iframes.
 * This panel handles:
 * - Objective, context level, model selection
 * - Generate baseline
 * - Telemetry history (compact strip + expandable table)
 */

import { marked } from "marked";

import {
  loadUiSkill,
  loadPropertySkill,
  loadPersona,
  loadRefinementSkill,
  loadChatSkill,
  loadEditorialSkill,
} from "./prompts.js";
import { generate, refine } from "./pipeline.js";
import { AppFrame } from "./app-frame.js";
import { Telemetry } from "./telemetry.js";
import {
  PROPERTIES,
  PROPERTY_CONTEXT,
  formatPropertiesForPrompt,
} from "./data/properties.js";
import {
  formatPlaybooksForPrompt,
  PLAYBOOKS,
} from "./data/playbooks.js";
import { formatPartyForPrompt } from "./data/party.js";

export { RefinementPanel };

type GeminiModel = "gemini-3.1-pro-preview" | "gemini-3.1-flash-lite-preview";
type AppPreset = "properties" | "magazine" | "party";

interface PresetConfig {
  label: string;
  objective: string;
  dataset: string;
  context: string;
  rawDataSummary: string;
}

const PRESETS: Record<AppPreset, PresetConfig> = {
  properties: {
    label: "Property Finder",
    objective: "Help me find a house",
    dataset: formatPropertiesForPrompt("rich"),
    context: PROPERTY_CONTEXT,
    rawDataSummary: `${PROPERTIES.length} properties in Brooklyn, NY`,
  },
  magazine: {
    label: "Editorial Briefing",
    objective: "Show me my daily briefing",
    dataset: formatPlaybooksForPrompt(),
    context: "",
    rawDataSummary: `${PLAYBOOKS.length} active playbooks`,
  },
  party: {
    label: "Party Planner",
    objective: "Help me plan Sasha's birthday party",
    dataset: formatPartyForPrompt(),
    context: "",
    rawDataSummary: "1 party with guests, tasks & venues",
  },
};

class RefinementPanel {
  #container: HTMLElement;
  #appFrame: AppFrame;
  #telemetry = new Telemetry();

  // State
  #selectedApp: AppPreset = "properties";
  #model: GeminiModel = "gemini-3.1-pro-preview";
  #refineModel: GeminiModel = "gemini-3.1-flash-lite-preview";
  #generating = false;
  #refining = false;
  #setupExpanded = true;
  #showHistory = false;
  #surfacePrefs: Record<AppPreset, string[]> = {
    properties: [],
    magazine: [],
    party: [],
  };
  #surfaceMemory: Record<AppPreset, string> = {
    properties: "",
    magazine: "",
    party: "",
  };
  #universals = "";

  // Loaded assets
  #uiSkill = "";
  #propertySkill = "";
  #editorialSkill = "";
  #persona = "";
  #refinementSkill = "";
  #chatSkill = "";
  #dataset = "";

  // Callbacks for ChatStrip coordination
  #onRefineComplete: (() => void) | null = null;
  #onStateChange: (() => void) | null = null;

  constructor(container: HTMLElement, appFrame: AppFrame) {
    this.#container = container;
    this.#appFrame = appFrame;
    this.#dataset = formatPropertiesForPrompt("rich");
    this.#loadPreferences();

    this.#appFrame.onPromote = (_promoted) => {
      const runs = this.#telemetry.runs;
      const lastRefinement = runs.find((r) => r.type === "refinement");
      if (lastRefinement) {
        this.#telemetry.markPromoted(lastRefinement.id);
      }
      this.#render();
      this.#onStateChange?.();
    };

    this.#appFrame.onDiscard = () => {
      this.#render();
      this.#onStateChange?.();
    };

    this.#init();
  }

  get telemetry(): Telemetry {
    return this.#telemetry;
  }

  get isRefining(): boolean {
    return this.#refining;
  }

  get isGenerating(): boolean {
    return this.#generating;
  }

  get chatSkill(): string {
    return this.#chatSkill;
  }

  get preferences(): string[] {
    return this.#surfacePrefs[this.#selectedApp];
  }

  get memory(): string {
    const surface = this.#surfaceMemory[this.#selectedApp];
    if (!this.#universals) return surface;
    if (!surface) return this.#universals;
    return surface + "\n" + this.#universals;
  }

  get universals(): string {
    return this.#universals;
  }

  updatePreferences(preferences: string[], memory: string) {
    this.#surfacePrefs[this.#selectedApp] = preferences;
    this.#surfaceMemory[this.#selectedApp] = memory;
    this.#savePreferences();
    this.#render();
  }

  updateUniversals(universals: string) {
    this.#universals = universals;
    this.#savePreferences();
    this.#render();
  }

  set onRefineComplete(fn: () => void) {
    this.#onRefineComplete = fn;
  }

  set onStateChange(fn: () => void) {
    this.#onStateChange = fn;
  }

  async #init() {
    try {
      const [
        uiSkill,
        propertySkill,
        editorialSkill,
        persona,
        refinementSkill,
        chatSkill,
      ] = await Promise.all([
        loadUiSkill(),
        loadPropertySkill(),
        loadEditorialSkill(),
        loadPersona(),
        loadRefinementSkill(),
        loadChatSkill(),
      ]);
      this.#uiSkill = uiSkill;
      this.#propertySkill = propertySkill;
      this.#editorialSkill = editorialSkill;
      this.#persona = persona;
      this.#refinementSkill = refinementSkill;
      this.#chatSkill = chatSkill;
    } catch {
      this.#uiSkill = "// Failed to load skills";
    }

    (window as unknown as Record<string, unknown>).__dump = () => ({
      runs: this.#telemetry.runs,
      markdown: this.#telemetry.toMarkdown(),
    });

    this.#render();
  }

  #render() {
    this.#container.innerHTML = "";
    this.#container.className = "panel";

    // ─── Header + Telemetry Strip ────────────────────────────────────
    const header = el("div", "panel-header");
    const titleRow = el("div", "panel-title-row");
    titleRow.innerHTML = `<h1>Refinement Loop</h1>`;
    header.appendChild(titleRow);

    const lastRun = this.#telemetry.runs[0];
    if (lastRun) {
      const telStrip = el("div", "tel-strip");
      telStrip.innerHTML = `
        <span class="tel-badge">${lastRun.type}</span>
        <span class="tel-model">${lastRun.model.replace("gemini-3.1-", "").replace("-preview", "")}</span>
        <span class="tel-value">${(lastRun.totalTimeMs / 1000).toFixed(1)}s</span>
        ${lastRun.feedbackLevel ? `<span class="tel-badge">${lastRun.feedbackLevel}</span>` : ""}
      `;

      const histBtn = el<HTMLButtonElement>("button", "tel-hist-btn");
      histBtn.textContent = `${this.#telemetry.runs.length} runs`;
      histBtn.addEventListener("click", () => {
        this.#showHistory = !this.#showHistory;
        this.#render();
      });
      telStrip.appendChild(histBtn);
      header.appendChild(telStrip);
    }
    this.#container.appendChild(header);

    // History table
    if (this.#showHistory) {
      const histSection = el("div", "panel-section history-section");
      const histHeader = el("div", "tel-header");
      histHeader.innerHTML = `<label class="section-label">Run History</label>`;
      const clearBtn = el<HTMLButtonElement>("button", "btn-link");
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        this.#telemetry.clearAll();
        this.#showHistory = false;
        this.#render();
      });
      histHeader.appendChild(clearBtn);
      histSection.appendChild(histHeader);

      const table = document.createElement("table");
      table.className = "tel-table-element";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      for (const label of ["#", "Type", "Model", "Ctx", "Feedback", "Gen", "Total", "Files", "✓"]) {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (let i = 0; i < this.#telemetry.runs.length; i++) {
        const r = this.#telemetry.runs[i];
        const row = document.createElement("tr");
        row.className = "tel-row-clickable";

        const hasCode = this.#telemetry.getCode(r.id) !== null;
        if (hasCode) {
          row.title = "Click to preview this version";
          row.addEventListener("click", () => this.#replayRun(r.id, i));
        } else {
          row.classList.add("no-code");
          row.title = "No stored code for this run";
        }

        const cells = [
          `${this.#telemetry.runs.length - i}`,
          r.type,
          r.model.replace("gemini-3.1-", "").replace("-preview", ""),
          r.contextLevel ?? "—",
          r.feedbackLevel ?? "—",
          `${(r.generateTimeMs / 1000).toFixed(1)}s`,
          `${(r.totalTimeMs / 1000).toFixed(1)}s`,
          `${r.outputFileCount}`,
          r.promoted ? "✓" : "—",
        ];

        for (const [j, text] of cells.entries()) {
          const td = document.createElement("td");
          if (j === 1) {
            const badge = el("span", "tel-badge");
            badge.textContent = text;
            td.appendChild(badge);
          } else {
            td.textContent = text;
          }
          row.appendChild(td);
        }

        tbody.appendChild(row);
      }
      table.appendChild(tbody);

      const tableWrap = el("div", "tel-table");
      tableWrap.appendChild(table);
      histSection.appendChild(tableWrap);
      this.#container.appendChild(histSection);
    }

    // ─── Setup Section ───────────────────────────────────────────────
    const setupSection = el("div", "panel-section");

    const setupToggle = el("button", "section-toggle");
    setupToggle.innerHTML = `
      <label class="section-label">Setup</label>
      <span class="material-symbols-outlined toggle-chevron">${
        this.#setupExpanded ? "expand_less" : "expand_more"
      }</span>
    `;
    setupToggle.addEventListener("click", () => {
      this.#setupExpanded = !this.#setupExpanded;
      this.#render();
    });
    setupSection.appendChild(setupToggle);

    if (this.#setupExpanded) {
      const setupBody = el("div", "section-body");

      // App preset selector
      const appRow = el("div", "field-row");
      const appLabel = el("span", "field-label");
      appLabel.textContent = "App";
      appRow.appendChild(appLabel);
      const appSelect = el("select", "field-select") as HTMLSelectElement;
      for (const [id, preset] of Object.entries(PRESETS)) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = preset.label;
        if (id === this.#selectedApp) opt.selected = true;
        appSelect.appendChild(opt);
      }
      appSelect.addEventListener("change", () => {
        this.#selectedApp = appSelect.value as AppPreset;
        this.#dataset = PRESETS[this.#selectedApp].dataset;
        this.#render();
      });
      appRow.appendChild(appSelect);
      setupBody.appendChild(appRow);

      const objectiveInput = el("input", "field-input") as HTMLInputElement;
      objectiveInput.type = "text";
      objectiveInput.value = PRESETS[this.#selectedApp].objective;
      objectiveInput.id = "objective-input";
      setupBody.appendChild(objectiveInput);

      const modelRow = el("div", "field-row");
      const baseLabel = el("span", "field-label");
      baseLabel.textContent = "Models";
      modelRow.appendChild(baseLabel);
      const modelGroup = el("div", "model-group");
      modelGroup.appendChild(
        this.#createModelSelect("Base", this.#model, (v) => {
          this.#model = v as GeminiModel;
        })
      );
      modelGroup.appendChild(
        this.#createModelSelect("Refine", this.#refineModel, (v) => {
          this.#refineModel = v as GeminiModel;
        })
      );
      modelRow.appendChild(modelGroup);
      setupBody.appendChild(modelRow);

      const genBtn = el<HTMLButtonElement>("button", "btn btn-primary");
      genBtn.textContent = this.#generating
        ? "Generating…"
        : "Generate Baseline";
      genBtn.disabled = this.#generating;
      genBtn.addEventListener("click", () => this.#generateBaseline());
      setupBody.appendChild(genBtn);

      // Data peek button
      const dataBtn = el<HTMLButtonElement>("button", "btn btn-subtle");
      dataBtn.textContent = `📋 View Data (${PRESETS[this.#selectedApp].rawDataSummary})`;
      dataBtn.addEventListener("click", () => this.#showDataOverlay());
      setupBody.appendChild(dataBtn);

      setupSection.appendChild(setupBody);
    }
    this.#container.appendChild(setupSection);

    // ─── Preferences Section ────────────────────────────────────────
    const surfacePrefs = this.#surfacePrefs[this.#selectedApp];
    const hasUniversals = this.#universals.length > 0;
    if (surfacePrefs.length > 0 || hasUniversals) {
      const prefSection = el("div", "panel-section pref-section-panel");
      const prefHeader = el("div", "pref-header-row");
      const prefLabel = el("span", "section-label");
      const presetLabel = PRESETS[this.#selectedApp].label;
      prefLabel.textContent = `Preferences — ${presetLabel} (${surfacePrefs.length})`;
      prefHeader.appendChild(prefLabel);

      const clearBtn = el<HTMLButtonElement>("button", "btn-link");
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        this.#surfacePrefs[this.#selectedApp] = [];
        this.#surfaceMemory[this.#selectedApp] = "";
        this.#savePreferences();
        this.#render();
        this.#onStateChange?.();
      });
      prefHeader.appendChild(clearBtn);
      prefSection.appendChild(prefHeader);

      if (surfacePrefs.length > 0) {
        const prefList = el("ul", "pref-list-panel");
        for (const pref of surfacePrefs) {
          const li = document.createElement("li");
          li.textContent = pref;
          prefList.appendChild(li);
        }
        prefSection.appendChild(prefList);
      }

      // Infer Universals button — needs preferences from at least one surface
      const totalPrefs =
        this.#surfacePrefs.properties.length +
        this.#surfacePrefs.magazine.length;
      if (totalPrefs > 0) {
        const inferBtn = el<HTMLButtonElement>("button", "btn btn-subtle");
        inferBtn.textContent = hasUniversals
          ? "↻ Re-infer Universals"
          : "⚡ Infer Universals";
        inferBtn.addEventListener("click", () => this.#inferUniversals());
        prefSection.appendChild(inferBtn);
      }

      // Show universals if we have them
      if (hasUniversals) {
        const uniHeader = el("div", "pref-header-row");
        const uniLabel = el("span", "section-label");
        uniLabel.textContent = "Universals";
        uniHeader.appendChild(uniLabel);

        const clearBtn = el<HTMLButtonElement>("button", "btn-link");
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("click", () => {
          this.updateUniversals("");
          this.#render();
        });
        uniHeader.appendChild(clearBtn);

        prefSection.appendChild(uniHeader);

        const uniBlock = el("div", "pref-universals");
        uniBlock.textContent = this.#universals;
        prefSection.appendChild(uniBlock);
      }

      this.#container.appendChild(prefSection);
    }
  }

  #createModelSelect(
    label: string,
    current: GeminiModel,
    onChange: (v: string) => void
  ): HTMLElement {
    const wrap = el("div", "model-select-wrap");
    const labelEl = el("span", "model-label");
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const select = el("select", "field-select small") as HTMLSelectElement;
    for (const [value, name] of [
      ["gemini-3.1-pro-preview", "Pro"],
      ["gemini-3.1-flash-lite-preview", "Flash"],
    ] as const) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = name;
      if (value === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => onChange(select.value));
    wrap.appendChild(select);
    return wrap;
  }

  async #generateBaseline() {
    if (this.#generating) return;
    this.#generating = true;
    this.#setupExpanded = false;
    this.#appFrame.showLoading("current");
    this.#render();

    const objective =
      (document.getElementById("objective-input") as HTMLInputElement)?.value ??
      PRESETS[this.#selectedApp].objective;
    const context = PRESETS[this.#selectedApp].context;

    const genStart = performance.now();
    try {
      const appSkill =
        this.#selectedApp === "magazine"
          ? this.#editorialSkill
          : this.#selectedApp === "properties"
            ? this.#propertySkill
            : ""; // party: ui-skill only — universals provide the flavour
      const result = await generate({
        objective,
        context,
        skill: this.#uiSkill + "\n\n---\n\n" + appSkill,
        persona: this.#persona,
        dataset: this.#dataset,
        model: this.#model,
        memory: this.memory,
        onThought: (text) => {
          this.#appFrame.appendStreamText("current", text);
        },
      });

      const genTime = performance.now() - genStart;
      const xfmStart = performance.now();

      await this.#appFrame.setBaseline(result.code, result.files);

      const xfmTime = performance.now() - xfmStart;

      const totalChars = Object.values(result.files).reduce(
        (sum, f) => sum + f.length,
        0
      );

      this.#telemetry.addRun(
        {
          type: "baseline",
          generateTimeMs: Math.round(genTime),
          transformTimeMs: Math.round(xfmTime),
          totalTimeMs: Math.round(genTime + xfmTime),
          promptSizeChars: objective.length + context.length,
          outputFileCount: Object.keys(result.files).length,
          outputTotalChars: totalChars,
          model: this.#model,
          contextLevel: this.#selectedApp,
          version: this.#appFrame.currentVersion,
        },
        result.code,
        result.files
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#appFrame.showError("current", message);
    } finally {
      this.#generating = false;
      this.#render();
      this.#onStateChange?.();
    }
  }

  /**
   * Trigger a refinement. Called by ChatStrip.
   * Uses workingFiles (cumulative against candidate).
   */
  async triggerRefine(
    feedback: string,
    feedbackLabel: string,
    modelOverride?: GeminiModel
  ) {
    if (this.#refining || !this.#appFrame.workingFiles) return;
    this.#refining = true;
    this.#appFrame.showLoading("candidate");
    this.#render();

    const genStart = performance.now();
    try {
      const appSkill =
        this.#selectedApp === "magazine"
          ? this.#editorialSkill
          : this.#propertySkill;
      const result = await refine({
        files: this.#appFrame.workingFiles,
        feedback,
        memory: this.memory,
        skill: this.#uiSkill + "\n\n---\n\n" + appSkill,
        refinementSkill: this.#refinementSkill,
        persona: this.#persona,
        model: modelOverride ?? this.#refineModel,
        onThought: (text) => {
          this.#appFrame.appendStreamText("candidate", text);
        },
      });

      const genTime = performance.now() - genStart;
      const xfmStart = performance.now();

      await this.#appFrame.setCandidate(result.code, result.files);

      const xfmTime = performance.now() - xfmStart;

      const totalChars = Object.values(result.files).reduce(
        (sum, f) => sum + f.length,
        0
      );

      this.#telemetry.addRun(
        {
          type: "refinement",
          generateTimeMs: Math.round(genTime),
          transformTimeMs: Math.round(xfmTime),
          totalTimeMs: Math.round(genTime + xfmTime),
          promptSizeChars: feedback.length,
          outputFileCount: Object.keys(result.files).length,
          outputTotalChars: totalChars,
          model: this.#refineModel,
          feedbackLevel: feedbackLabel,
          feedbackText: feedback,
          version: this.#appFrame.currentVersion,
        },
        result.code,
        result.files
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#appFrame.showError("candidate", message);
    } finally {
      this.#refining = false;
      this.#render();
      this.#onRefineComplete?.();
    }
  }

  #showDataOverlay() {
    const backdrop = el("div", "data-overlay-backdrop");
    const modal = el("div", "data-overlay-modal");

    const header = el("div", "data-overlay-header");
    const title = el("h3");
    title.textContent = `${PRESETS[this.#selectedApp].label} — Raw Data`;
    header.appendChild(title);

    const closeBtn = el<HTMLButtonElement>("button", "btn-link");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => backdrop.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const content = el("div", "data-overlay-content");
    content.innerHTML = marked.parse(
      PRESETS[this.#selectedApp].dataset
    ) as string;
    modal.appendChild(content);

    const context = PRESETS[this.#selectedApp].context;
    if (context) {
      const ctxHeader = el("h4", "data-overlay-subheader");
      ctxHeader.textContent = "User Context";
      modal.appendChild(ctxHeader);

      const ctxContent = el("div", "data-overlay-content");
      ctxContent.innerHTML = marked.parse(context) as string;
      modal.appendChild(ctxContent);
    }

    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  async #replayRun(runId: string, index: number) {
    const code = this.#telemetry.getCode(runId);
    const files = this.#telemetry.getFiles(runId);
    if (!code || !files) return;

    const run = this.#telemetry.runs[index];
    const runNumber = this.#telemetry.runs.length - index;
    const label = `Run #${runNumber} (${run.type}${run.feedbackLevel ? ` · ${run.feedbackLevel}` : ""})`;

    if (!this.#appFrame.hasBaseline) {
      // No current — this becomes the baseline.
      await this.#appFrame.setBaseline(code, files);
    } else {
      // Compare against current.
      await this.#appFrame.previewRun(code, files, label);
    }
    this.#showHistory = false;
    this.#render();
    this.#onStateChange?.();
  }

  #loadPreferences() {
    try {
      const raw = localStorage.getItem("ea-refinement-prefs-v2");
      if (raw) {
        const data = JSON.parse(raw);
        this.#surfacePrefs = data.surfacePrefs ?? {
          properties: [],
          magazine: [],
          party: [],
        };
        // Ensure party key exists for older v2 data
        this.#surfacePrefs.party ??= [];
        this.#surfaceMemory = data.surfaceMemory ?? {
          properties: "",
          magazine: "",
          party: "",
        };
        this.#surfaceMemory.party ??= "";
        this.#universals = data.universals ?? "";
      }
    } catch {
      // Ignore corrupt data.
    }
  }

  #savePreferences() {
    try {
      localStorage.setItem(
        "ea-refinement-prefs-v2",
        JSON.stringify({
          surfacePrefs: this.#surfacePrefs,
          surfaceMemory: this.#surfaceMemory,
          universals: this.#universals,
        })
      );
    } catch {
      // localStorage full or unavailable.
    }
  }

  async #inferUniversals() {
    const propertyNotes = this.#surfaceMemory.properties;
    const editorialNotes = this.#surfaceMemory.magazine;
    if (!propertyNotes && !editorialNotes) return;

    try {
      const res = await fetch("/api/infer-universals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surfaces: {
            "Property Finder": propertyNotes || "(no preferences yet)",
            "Editorial Briefing": editorialNotes || "(no preferences yet)",
          },
        }),
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      if (data.universals) {
        this.updateUniversals(data.universals);
      }
    } catch (err) {
      console.error("Failed to infer universals:", err);
    }
  }
}

function el<T extends HTMLElement>(tag: string, className?: string): T {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element as T;
}
