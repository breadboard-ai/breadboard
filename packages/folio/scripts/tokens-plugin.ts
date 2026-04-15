/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

interface DirectToken {
  value: string;
}

interface ThemedToken {
  light: string;
  dark: string;
}

type Token = DirectToken | ThemedToken;

interface TokenData {
  tokens: Record<string, Token>;
}

function isThemedToken(token: Token): token is ThemedToken {
  return "light" in token && "dark" in token;
}

function isDirectToken(token: Token): token is DirectToken {
  return "value" in token;
}

export function tokenPlugin() {
  const jsonPath = path.resolve(process.cwd(), "frontend/ui/tokens.json");
  const cssPath = path.resolve(process.cwd(), "frontend/public/tokens.css");
  const tsPath = path.resolve(process.cwd(), "frontend/ui/tokens.ts");

  return {
    name: "generate-tokens",
    buildStart() {
      generate();
    },
    handleHotUpdate({
      file,
      server,
    }: {
      file: string;
      server: { ws: { send(val: { type: string }): void } };
    }) {
      if (file.endsWith("tokens.json")) {
        generate();
        server.ws.send({ type: "full-reload" });
      }
    },
  };

  function generate() {
    if (!fs.existsSync(jsonPath)) {
      console.warn(`Tokens JSON not found at ${jsonPath}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as TokenData;

    fs.writeFileSync(cssPath, buildCss(data));
    fs.writeFileSync(tsPath, buildTs(data));
  }

  function buildCss(data: TokenData): string {
    let css = `/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* GENERATED FILE - DO NOT EDIT */

:root {
  color-scheme: light dark;
`;

    const directTokens: string[] = [];
    const themedTokens: string[] = [];
    const assignments: string[] = [];

    for (const [key, token] of Object.entries(data.tokens)) {
      if (isDirectToken(token)) {
        directTokens.push(`  --opal-${key}: ${token.value};`);
      } else if (isThemedToken(token)) {
        themedTokens.push(`  --opal-theme-light-${key}: ${token.light};`);
        themedTokens.push(`  --opal-theme-dark-${key}: ${token.dark};`);
        assignments.push(
          `  --opal-${key}: light-dark(var(--opal-theme-light-${key}), var(--opal-theme-dark-${key}));`
        );
      }
    }

    if (directTokens.length > 0)
      css += `\n  /* Direct Tokens */\n${directTokens.join("\n")}\n`;
    if (themedTokens.length > 0)
      css += `\n  /* Theme Palettes */\n${themedTokens.join("\n")}\n`;
    if (assignments.length > 0)
      css += `\n  /* Assignments using light-dark() */\n${assignments.join("\n")}\n`;

    css += `}\n`;
    return css;
  }

  function buildTs(data: TokenData): string {
    const grid: Record<string, string> = {};
    const light: Record<string, string> = {};
    const dark: Record<string, string> = {};
    const values: Record<string, string> = {};

    for (const [key, token] of Object.entries(data.tokens)) {
      if (isDirectToken(token)) {
        if (key.startsWith("grid-")) {
          grid[key.replace("grid-", "")] = token.value;
        } else {
          values[key] = token.value;
        }
      } else if (isThemedToken(token)) {
        light[key] = token.light;
        dark[key] = token.dark;
      }
    }

    return `/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* GENERATED FILE - DO NOT EDIT */

export const tokens = {
  grid: ${formatJson(grid, 2)},
  theme: {
    light: ${formatJson(light, 4)},
    dark: ${formatJson(dark, 4)}
  },
  values: ${formatJson(values, 2)}
};
`;
  }

  function formatJson(obj: unknown, indent: number): string {
    return JSON.stringify(obj, null, 2).replace(
      /\n/g,
      "\n" + " ".repeat(indent)
    );
  }
}
