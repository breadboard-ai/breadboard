/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ts from "typescript";
import * as tsvfs from "@typescript/vfs";

const bdts = `declare module "breadboard:capabilities" {
  /**
   * Fetches data.
   * @param url
   */
  export function fetch(
    url: string
  ): Promise<{ response: Response; $error?: string | null }>;

  /**
   * Obtains secrets.
   */
  export function secrets(sekrits: {
    keys: string[];
  }): Promise<Record<string, string>>;
}
`;

export class TypeScriptEnv {
  #compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    esModuleInterop: true,
    declaration: false,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
  };

  #tsEnv!: tsvfs.VirtualTypeScriptEnvironment;
  readonly ready: Promise<void> = this.#reset();

  async #reset() {
    const fsMap = await tsvfs.createDefaultMapFromCDN(
      this.#compilerOptions,
      ts.version,
      true,
      ts
    );

    const system = tsvfs.createSystem(fsMap);

    this.#tsEnv = tsvfs.createVirtualTypeScriptEnvironment(
      system,
      [...fsMap.keys()],
      ts,
      this.#compilerOptions
    );

    this.createFile("breadboard.d.ts", bdts);
  }

  createFile(fileName: string, content: string) {
    this.#tsEnv.createFile(`${fileName}`, content);
  }

  updateFile(fileName: string, content: string) {
    this.#tsEnv.updateFile(`${fileName}`, content);
  }

  deleteFile(fileName: string) {
    this.#tsEnv.deleteFile(`${fileName}`);
  }

  getCompletionsAtPosition(
    fileName: string,
    position: number,
    triggerCharacter?: ts.CompletionsTriggerCharacter,
    triggerKind?: ts.CompletionTriggerKind
  ) {
    return this.#tsEnv.languageService.getCompletionsAtPosition(
      fileName,
      position,
      {
        triggerCharacter,
        triggerKind,
        includeCompletionsForImportStatements: true,
      }
    );
  }

  getQuickInfoAtPosition(fileName: string, position: number) {
    return this.#tsEnv.languageService.getQuickInfoAtPosition(
      fileName,
      position
    );
  }

  getSignatureHelp(
    fileName: string,
    position: number,
    triggerReason: ts.SignatureHelpTriggerReason
  ) {
    return this.#tsEnv.languageService.getSignatureHelpItems(
      fileName,
      position,
      { triggerReason }
    );
  }

  connvertToDOM(info: ts.QuickInfo) {
    const dom = document.createElement("div");
    const para = document.createElement("p");
    dom.classList.add("signature");
    para.textContent =
      info.documentation?.reduce((prev, curr) => {
        if (curr.kind !== "text") {
          return prev;
        }

        return prev + `\n${curr.text}`;
      }, "") ?? "No documentation";

    dom.appendChild(para);
    return dom;
  }

  convertSignatureInfoToDOM(signature: ts.SignatureHelpItems) {
    const dom = document.createElement("div");
    dom.classList.add("signature");

    for (const item of signature.items) {
      if (item.documentation) {
        for (const entry of item.documentation) {
          const para = document.createElement("p");
          para.textContent = entry.text;
          dom.appendChild(para);
        }
      }

      const paramList = document.createElement("div");
      for (let p = 0; p < item.parameters.length; p++) {
        const param = item.parameters[p];
        const paramLabel = param.displayParts.map((part) => part.text).join("");
        const paramSpan = document.createElement("span");
        paramSpan.textContent =
          paramLabel + (p < item.parameters.length - 1 ? "," : "");

        if (p === signature.argumentIndex) {
          paramSpan.classList.add("active");
        }

        paramList.appendChild(paramSpan);
      }

      dom.appendChild(paramList);
    }

    return dom;
  }

  getFileContents(fileName: string) {
    return this.#tsEnv.getSourceFile(fileName)?.getText();
  }

  getCompiledFileContents(fileName: string) {
    const src = this.getFileContents(fileName);
    if (!src) {
      throw new Error(`Unable to compile file; ${fileName} not found`);
    }

    const { outputText } = ts.transpileModule(src, {
      compilerOptions: this.#compilerOptions,
    });

    return outputText;
  }
}
