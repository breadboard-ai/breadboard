/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GraphDescriptor,
  GraphProviderCapabilities,
  InspectableGraph,
  InspectableModules,
  InspectableNodePorts,
  InspectableRun,
  MutableGraphStore,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { CodeEditor, ModuleRibbonMenu } from "../elements";
import {
  GraphIdentifier,
  ModuleCode,
  ModuleIdentifier,
  ModuleLanguage,
  Modules,
} from "@breadboard-ai/types";
import { until } from "lit/directives/until.js";
import {
  CodeChangeEvent,
  CommandsAvailableEvent,
  ModuleEditEvent,
  OverflowMenuActionEvent,
  ToastEvent,
  ToastType,
} from "../../events/events";
import { guard } from "lit/directives/guard.js";
import {
  CodeMirrorExtensions,
  Command,
  TopGraphRunResult,
} from "../../types/types";
import { typeDeclarations as builtIns } from "@breadboard-ai/jsandbox";
import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { getMappedQuickJsModList } from "./ts-library";
import {
  COMMAND_SET_MODULE_EDITOR,
  MAIN_BOARD_ID,
} from "../../constants/constants";
import { GraphOpts } from "../editor/types";

const PREVIEW_KEY = "bb-module-editor-preview-visible";

type CompilationEnvironment = {
  language: ModuleLanguage;
  moduleId: ModuleIdentifier | null;
  env: VirtualTypeScriptEnvironment | null;
  extensions: CodeMirrorExtensions | null;
  compile(code: ModuleCode): ModuleCode;
};

@customElement("bb-module-editor")
export class ModuleEditor extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  moduleId: ModuleIdentifier | null = null;

  @property()
  modules: InspectableModules = {};

  @property({ reflect: true })
  focused = false;

  @property()
  readOnly = false;

  @property()
  assetPrefix = "";

  @property()
  renderId = "";

  @property()
  run: InspectableRun | null = null;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @property()
  isShowingBoardActivityOverlay = false;

  @property()
  showModulePreview = false;

  @property()
  capabilities: false | GraphProviderCapabilities = false;

  @property()
  graphStore: MutableGraphStore | null = null;

  @state()
  private previewUpdateId = 0;

  @state()
  private formatting = false;

  @state()
  private errorCount = 0;

  @state()
  private showCommandPalette = false;

  @state()
  private showModulePalette = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    section {
      display: grid;
      grid-template-rows: 44px minmax(0, 1fr);
      row-gap: var(--bb-grid-size-4);
      width: 100%;
      height: 100%;
      position: relative;
    }

    bb-module-ribbon-menu {
      z-index: 7;
    }

    #module-graph {
      border-radius: var(--bb-grid-size);
      height: 40vh;
      width: 40vw;
      max-height: 340px;
      max-width: 340px;
      overflow: hidden;
      position: absolute;
      right: 32px;
      top: 76px;
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);
      z-index: 4;
      opacity: 1;
      pointer-events: none;
    }

    bb-graph-renderer {
      width: 100%;
      height: 100%;
    }

    #code-container {
      padding: 0 var(--bb-grid-size-4);
      margin-bottom: var(--bb-grid-size-4);
      width: 100%;
    }

    #code-container-outer {
      width: 100%;
      height: 100%;
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      overflow-y: auto;
    }

    :host([focused="true"]) #code-container-outer {
      border: 1px solid var(--bb-ui-700);
      box-shadow: inset 0 0 0 1px var(--bb-ui-700);
    }

    #code-container-inner {
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      background: white;
      position: relative;
    }

    #code-container-inner::before {
      content: "";
      background-color: rgb(245, 245, 245);
      color: rgb(108, 108, 108);
      border-right: 1px solid rgb(221, 221, 221);
      width: 20px;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    #revert {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #update {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #update:not([disabled]):hover,
    #update:not([disabled]):focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    #update[disabled] {
      opacity: 0.5;
      cursor: default;
    }

    #buttons > div {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      padding-right: var(--bb-grid-size-4);
      flex: 0 0 auto;
    }

    .loading-env {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
    }

    bb-command-palette {
      position: absolute;
      top: calc(var(--bb-grid-size-2) + 44px);
      left: 50%;
      width: 75%;
      max-width: 650px;
      transform: translateX(-50%);
      z-index: 6;
    }
  `;

  #moduleRibbonMenuRef: Ref<ModuleRibbonMenu> = createRef();
  #codeEditorRef: Ref<CodeEditor> = createRef();
  #compilationEnvironment: CompilationEnvironment = {
    language: "javascript",
    moduleId: null,
    env: null,
    extensions: null,
    compile: (code: ModuleCode) => code,
  };
  #hasUnsavedChanges = false;
  #errorDetails: Array<{ message: string; start: number }> | null = null;
  #moduleCount = -1;
  #editorId = globalThis.crypto.randomUUID();

  #commandFormatCodeBound = this.#commandFormatCode.bind(this);
  #commandSaveCodeBound = this.#commandSaveCode.bind(this);

  connectedCallback(): void {
    super.connectedCallback();

    this.showModulePreview =
      globalThis.localStorage.getItem(PREVIEW_KEY) === "true";
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (Object.keys(this.modules).length !== this.#moduleCount) {
      this.#moduleCount = Object.keys(this.modules).length;
      this.#editorId = globalThis.crypto.randomUUID();
    }

    if (changedProperties.has("errorCount")) {
      this.#emitCommands();
    }
  }

  #commandFormatCode() {
    this.#formatCode();
  }

  #commandSaveCode(_command: string, secondaryAction?: string | null) {
    this.#processEditorCodeWithEnvironment(true, secondaryAction === "force");
  }

  #emitCommands() {
    const commands: Command[] = [
      {
        title: "Format code",
        icon: "format",
        name: "format",
        callback: this.#commandFormatCodeBound,
      },
    ];

    if (this.errorCount > 0) {
      commands.push({
        title: "Force save module",
        icon: "save",
        name: "save",
        secondaryAction: "force",
        callback: this.#commandSaveCodeBound,
      });
    } else {
      commands.push({
        title: "Save module",
        icon: "save",
        name: "save",
        callback: this.#commandSaveCodeBound,
      });
    }

    this.dispatchEvent(
      new CommandsAvailableEvent(COMMAND_SET_MODULE_EDITOR, commands)
    );
  }

  async #resetCompilationEnvironment(
    language: ModuleLanguage,
    moduleId: ModuleIdentifier,
    definitions: Map<string, string> | null
  ) {
    this.#compilationEnvironment = {
      language,
      moduleId,
      env: null,
      extensions: null,
      compile: (code: ModuleCode) => code,
    };

    if (language !== "typescript") {
      return;
    }

    const [ts, tsvfs, { tsSync, tsFacet, tsLinter, tsAutocomplete, tsHover }] =
      await Promise.all([
        import("typescript"),
        import("@typescript/vfs"),
        import("@valtown/codemirror-ts"),
      ]);

    const compilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.Preserve,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
      declaration: true,
      rootDir: ".",
      noLib: true,
      allowJs: true,
      verbatimModuleSyntax: true,
    };

    const modules = getMappedQuickJsModList();
    const fsMap = new Map(await Promise.all(modules));
    const system = tsvfs.createSystem(fsMap);
    this.#compilationEnvironment.env = tsvfs.createVirtualTypeScriptEnvironment(
      system,
      [...fsMap.keys()],
      ts,
      compilerOptions
    );

    if (definitions) {
      for (const [fileName, contents] of definitions) {
        this.#compilationEnvironment.env.createFile(fileName, contents);
      }
    }

    this.#compilationEnvironment.compile = (code: string) => {
      if (!this.#compilationEnvironment.env) {
        console.warn("Unable to compile code");
        return code;
      }

      const sys = this.#compilationEnvironment.env.sys;
      const file = sys.readFile(`${this.moduleId}.ts`);
      if (!file) {
        console.warn("Unable to compile code");
        return code;
      }

      const { outputText } = ts.transpileModule(file, {
        compilerOptions,
      });

      return outputText;
    };

    this.#compilationEnvironment.extensions = {
      tsSync,
      tsFacet,
      tsLinter,
      tsAutocomplete,
      tsHover,
    };
  }

  #resetErrorState() {
    this.errorCount = 0;
    this.#errorDetails = null;
  }

  async #createEditor(
    code: ModuleCode,
    language: ModuleLanguage,
    definitions: Map<string, string> | null
  ) {
    if (!this.moduleId) {
      return nothing;
    }

    return html`${guard(
      [this.moduleId, this.graph?.raw().url, language, this.#editorId],
      () => {
        this.#resetErrorState();
        const editor = this.#resetCompilationEnvironment(
          language,
          this.moduleId!,
          definitions
        ).then(() => {
          const fileName = `${this.moduleId}.ts`;

          return html`<bb-code-editor
            ${ref(this.#codeEditorRef)}
            @pointerdown=${() => {
              this.showModulePalette = false;
              this.showCommandPalette = false;
            }}
            @bbcodechange=${async (evt: CodeChangeEvent) => {
              this.#hasUnsavedChanges = true;

              // User attempted a double save - ignore.
              if (this.formatting) {
                this.dispatchEvent(
                  new ToastEvent(
                    "Unable to save - already in process",
                    ToastType.WARNING
                  )
                );
                return;
              }

              if (evt.options.format) {
                await this.#formatCode();
              }

              if (evt.options.errors !== undefined) {
                this.errorCount = evt.options.errors;
                this.#errorDetails = evt.options.errorsDetail ?? null;
              }

              this.#processEditorCodeWithEnvironment(evt.options.manual);
            }}
            .passthru=${true}
            .value=${code}
            .language=${language}
            .definitions=${definitions}
            .env=${this.#compilationEnvironment.env}
            .extensions=${this.#compilationEnvironment.extensions}
            .fileName=${fileName}
          ></bb-code-editor>`;
        });

        return html`${until(
          editor,
          html`<div class="loading-env">Loading environment...</div>`
        )}`;
      }
    )}`;
  }

  #processEditorCodeWithEnvironment(manual = false, force = false) {
    if (!this.#codeEditorRef.value) {
      return;
    }

    const editor = this.#codeEditorRef.value;
    if (!editor.value) {
      return;
    }

    if (this.errorCount > 0 && !force) {
      // Only toast the user when they requested a save.
      if (manual) {
        this.dispatchEvent(
          new ToastEvent("Unable to save - code has errors", ToastType.WARNING)
        );
      }
      return;
    }

    const source = editor.value;
    const compiledCode = this.#compilationEnvironment.compile(editor.value);
    if (!this.#moduleRibbonMenuRef.value || !this.moduleId) {
      return;
    }

    const ribbonMenu = this.#moduleRibbonMenuRef.value;
    const module = this.modules[this.moduleId];
    if (!module) {
      return;
    }

    const metadata = module.metadata();
    const language = metadata.source?.language ?? "javascript";
    const description = this.#parseModuleDescription(source);

    if (language === "typescript") {
      metadata.source = { code: source, language: "typescript" };
    }
    metadata.description = description;
    metadata.runnable = ribbonMenu.moduleIsRunnable();

    this.#hasUnsavedChanges = false;
    this.dispatchEvent(
      new ModuleEditEvent(this.moduleId, compiledCode, metadata)
    );

    if (manual) {
      this.dispatchEvent(new ToastEvent("Code updated", ToastType.INFORMATION));
    }
  }

  async #formatCode() {
    if (!this.#codeEditorRef.value) {
      return;
    }

    const editor = this.#codeEditorRef.value;
    if (!editor.value) {
      return;
    }

    const [Prettier, PrettierESTree, PrettierTS] = await Promise.all([
      import("prettier"),
      // @ts-expect-error Does not provide types.
      import("prettier/plugins/estree.mjs"),
      // @ts-expect-error Does not provide types.
      import("prettier/plugins/typescript.mjs"),
    ]);

    try {
      const formatted = await Prettier.format(editor.value, {
        arrowParens: "always",
        printWidth: 80,
        semi: true,
        tabWidth: 2,
        trailingComma: "es5",
        useTabs: false,
        parser: "typescript",
        plugins: [PrettierESTree, PrettierTS],
      });

      editor.value = formatted;
    } catch (err) {
      const formatError = err as Error;
      const syntaxError = formatError.message.split("\n")[0];
      if (!syntaxError) {
        this.dispatchEvent(
          new ToastEvent("Error formatting code", ToastType.ERROR)
        );
        return;
      }

      this.dispatchEvent(new ToastEvent(syntaxError, ToastType.ERROR));
    }
  }

  #parseModuleDescription(code: string) {
    const matches = /@fileOverview([\s\S]*?)\*\//gim.exec(code);
    if (!matches) {
      return "";
    }

    return matches[1]
      .split("\n")
      .map((line) => line.replace(/\s?\*/, "").trim())
      .join("\n")
      .trim();
  }

  destroyEditor() {
    if (!this.#codeEditorRef.value) {
      return;
    }

    this.#codeEditorRef.value.destroy();
  }

  #inspectableGraphToConfig(
    url: string,
    subGraphId: string | null,
    selectedGraph: InspectableGraph
  ): GraphOpts {
    const ports = new Map<string, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
    for (const node of selectedGraph.nodes()) {
      ports.set(node.descriptor.id, node.currentPorts());
      try {
        typeMetadata.set(node.descriptor.type, node.type().currentMetadata());
      } catch (err) {
        // Ignore errors.
      }
    }

    return {
      url,
      title: selectedGraph.raw().title ?? "Untitled Board",
      subGraphId,
      minimized: false,
      showNodePreviewValues: false,
      collapseNodesByDefault: false,
      showGraphOutline: false,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      modules: selectedGraph.modules(),
      metadata: selectedGraph.metadata() || {},
      selectionState: null,
      references: null,
    };
  }

  #createModuleGraphConfig(
    isMainModule = false
  ): Map<GraphIdentifier, GraphOpts> | null {
    if (!this.moduleId || !this.modules) {
      return null;
    }

    if (!this.graphStore) {
      return null;
    }

    const modules: Modules = {};
    for (const [id, module] of Object.entries(this.modules)) {
      modules[id] = {
        code: module.code(),
        metadata: module.metadata(),
      };
    }

    const module = this.modules[this.moduleId];

    // Create a stable URL.
    const mainGraphURL = this.graph!.raw().url!;
    const url = `module-preview:${mainGraphURL}?module=${this.moduleId}`;
    const graph: GraphDescriptor = {
      url,
      title: module?.metadata().title,
      nodes: [
        isMainModule
          ? {
              id: this.moduleId,
              type: mainGraphURL,
              metadata: {
                title: this.graph?.raw().title ?? "Untitled Board",
                visual: {
                  collapsed: "expanded",
                },
              },
            }
          : {
              id: this.moduleId,
              type: "runModule",
              metadata: {
                title: module?.metadata().title,
                visual: {
                  collapsed: "expanded",
                },
              },
              configuration: {
                $module: this.moduleId,
              },
            },
      ],
      edges: [],
      modules,
    };

    const adding = this.graphStore.addByDescriptor(graph);
    if (!adding.success) {
      return null;
    }
    const mainGraphId = adding.result;

    this.graphStore.addEventListener("update", (evt) => {
      if (evt.mainGraphId === mainGraphId) {
        this.previewUpdateId++;
      }
    });

    const editableGraph = this.graphStore.edit(mainGraphId);
    const inspectableGraph = editableGraph?.inspect("");
    if (!inspectableGraph) {
      return null;
    }

    return new Map([
      [
        MAIN_BOARD_ID,
        this.#inspectableGraphToConfig(url, null, inspectableGraph),
      ],
    ]);
  }

  #togglePreview(value = !this.showModulePreview) {
    this.showModulePreview = value;
    globalThis.localStorage.setItem(PREVIEW_KEY, `${this.showModulePreview}`);
  }

  #attemptEditorFocus() {
    if (!this.#codeEditorRef.value) {
      return;
    }

    this.#codeEditorRef.value.attemptEditorFocus();
  }

  #confirmModuleChangeIfNeeded() {
    if (this.#hasUnsavedChanges) {
      return confirm(
        "There are unsaved changes. Are you sure you wish to proceed?"
      );
    }

    return true;
  }

  render() {
    if (!this.modules || !this.moduleId) {
      return nothing;
    }

    const isMainModule = this.graph?.main() === this.moduleId;
    const module = this.modules[this.moduleId];
    if (!module) {
      return nothing;
    }

    const isRunning = this.topGraphResult
      ? this.topGraphResult.status === "running" ||
        this.topGraphResult.status === "paused"
      : false;

    let isInputPending = false;
    let isError = false;
    const eventCount = this.run?.events.length ?? 0;
    const newestEvent = this.run?.events.at(-1);
    if (newestEvent) {
      isInputPending =
        newestEvent.type === "node" &&
        newestEvent.node.descriptor.type === "input";
      isError = newestEvent.type === "error";
    }

    let code = module.code();
    let language = "javascript";
    let definitions = null;
    const metadata = module.metadata();
    if (metadata.source) {
      const source = metadata.source;
      if (source.language === "typescript") {
        code = source.code;
        language = source.language;
      } else {
        console.warn(`Unexpected language ${source.language}`);
      }
    }

    if (language === "typescript" && this.modules) {
      // Add the built-in capabilities.
      definitions = new Map<string, string>([["/__builtins.d.ts", builtIns]]);

      // Add each of the other modules.
      for (const [name, contents] of Object.entries(this.modules)) {
        if (name === this.moduleId) {
          continue;
        }

        const source = contents.metadata().source;
        if (source && source.language === "typescript") {
          definitions.set(`/${name}.ts`, source.code);
          continue;
        } else {
          definitions.set(`/${name}.js`, contents.code());
        }
      }
    }

    const isRunnable = !!module.metadata().runnable || isMainModule;

    return html` <section>
      <bb-module-ribbon-menu
        ${ref(this.#moduleRibbonMenuRef)}
        .graph=${this.graph}
        .modules=${this.modules}
        .moduleId=${this.moduleId}
        .canSave=${this.capabilities && this.capabilities.save}
        .readOnly=${this.readOnly}
        .isRunning=${isRunning}
        .eventCount=${eventCount}
        .isInputPending=${isInputPending}
        .isError=${isError}
        .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
        .isShowingModulePreview=${this.showModulePreview}
        .canShowModulePreview=${isRunnable}
        .formatting=${this.formatting}
        .renderId=${globalThis.crypto.randomUUID()}
        .errorCount=${this.errorCount}
        .errorDetails=${this.#errorDetails}
        .showErrors=${this.#compilationEnvironment.language === "typescript"}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          if (evt.action.startsWith("error-")) {
            evt.stopImmediatePropagation();
            if (!this.#codeEditorRef.value) {
              return;
            }

            const location = Number.parseInt(
              evt.action.replace(/^error-/gim, ""),
              10
            );
            if (Number.isNaN(location)) {
              console.warn(`Unable to go to location ${evt.action}`);
              return;
            }

            this.#codeEditorRef.value.gotoLocation(location);
          }
        }}
        @input=${() => {
          this.#processEditorCodeWithEnvironment();
        }}
        @bbmodulechosen=${(evt: Event) => {
          if (!this.#confirmModuleChangeIfNeeded()) {
            evt.stopImmediatePropagation();
          }
        }}
        @bbtogglepreview=${() => this.#togglePreview()}
        @bbformatmodulecode=${async () => {
          if (this.formatting) {
            return;
          }

          this.formatting = true;
          await this.#formatCode();
          this.formatting = false;
        }}
      ></bb-module-ribbon-menu>
      <div id="code-container">
        <div id="code-container-outer">
          <div id="code-container-inner">
            ${until(this.#createEditor(code, language, definitions))}
          </div>
        </div>
      </div>
      ${isRunnable && this.showModulePreview
        ? html`
            <div id="module-graph">
              <bb-graph-renderer
                .padding=${28}
                .topGraphUrl=${globalThis.crypto.randomUUID()}
                .topGraphResult=${this.topGraphResult}
                .assetPrefix=${this.assetPrefix}
                .configs=${this.#createModuleGraphConfig(isMainModule)}
                .invertZoomScrollDirection=${false}
                .readOnly=${true}
                .highlightInvalidWires=${false}
                .showPortTooltips=${false}
                .showSubgraphsInline=${false}
                .selectionChangeId=${null}
              ></bb-graph-renderer>
            </div>
          `
        : nothing}
    </section>`;
  }
}
