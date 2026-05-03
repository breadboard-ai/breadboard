/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  renderJson,
  renderExpandButton,
} from "./json-tree.js";
import "./truncated-text.js";
import type {
  MergedSessionView,
  SessionSegment,
  LogPart,
  LogTurn,
  TurnGroup,
  LogTurnTokenMetadata,
} from "../data/types.js";
import { logDetailStyles } from "./log-detail.styles.js";

export { BeesLogDetail };

const TERMINATION_FUNCTIONS = new Set([
  "system_objective_fulfilled",
  "system_failed_to_fulfill_objective",
]);

const CONTEXT_UPDATE_RE = /^<context_update>([\s\S]*)<\/context_update>$/;

interface TokenBreakdown {
  cached: number;
  prompt: number; // new prompt (excludes cached)
  thoughts: number;
  output: number;
  total: number;
}

/**
 * Renders a unified timeline for a session: aggregate stats at the top,
 * then each run segment separated by visual dividers showing only the
 * NEW turns that segment contributed.
 */
@customElement("bees-log-detail")
class BeesLogDetail extends LitElement {
  @property({ type: Object })
  accessor data: MergedSessionView | null = null;

  static styles = [logDetailStyles];

  render() {
    if (!this.data) {
      return html`<div class="empty">Select a log entry to inspect.</div>`;
    }
    const d = this.data;
    const firstSegment = d.segments[0];

    return html`
      ${this.renderHeader(d)}
      ${this.renderTokenBar(d)}
      <div class="sections">
        ${this.renderSystemInstruction(firstSegment)}
        ${this.renderTools(firstSegment)}
      </div>
      ${this.renderTimeline(d)}
    `;
  }

  private renderHeader(d: MergedSessionView) {
    const duration = (d.totalDurationMs / 1000).toFixed(1);
    const started = d.segments[0]?.startedDateTime;
    return html`
      <div class="header">
        <div class="header-top">
          <h2>
            Session
            <code class="mono">${d.sessionId.slice(0, 13)}…</code>
          </h2>
          <span
            class="link-chip"
            @click=${() => this.#dispatchNavigate("ticket", d.sessionId)}
          >
            <span class="link-chip-label">task</span>
            ${d.sessionId.slice(0, 8)}
          </span>
          ${d.segments.length > 1
            ? html`<span class="segment-count"
                >${d.segments.length} runs</span
              >`
            : nothing}
        </div>
        <div class="header-meta">
          <span>${started ? new Date(started).toLocaleString() : "—"}</span>
          <span>${duration}s</span>
          <span
            >${d.totalTurns} turn${d.totalTurns !== 1 ? "s" : ""}</span
          >
          <span
            >${d.totalThoughts}
            thought${d.totalThoughts !== 1 ? "s" : ""}</span
          >
          <span
            >${d.totalFunctionCalls}
            call${d.totalFunctionCalls !== 1 ? "s" : ""}</span
          >
        </div>
      </div>
    `;
  }

  private aggregateTokens(d: MergedSessionView): TokenBreakdown {
    return d.segments.reduce(
      (acc, seg) => {
        const tm = seg.tokenMetadata;
        if (!tm) return acc;
        const newPrompt = Math.max(0, tm.totalPromptTokens - tm.totalCachedTokens);
        return {
          cached: acc.cached + tm.totalCachedTokens,
          prompt: acc.prompt + newPrompt,
          thoughts: acc.thoughts + tm.totalThoughtsTokens,
          output: acc.output + tm.totalCandidatesTokens,
          total: acc.total + tm.totalTokens,
        };
      },
      { cached: 0, prompt: 0, thoughts: 0, output: 0, total: 0 }
    );
  }

  private segmentTokens(seg: SessionSegment): TokenBreakdown {
    const tm = seg.tokenMetadata;
    if (!tm) return { cached: 0, prompt: 0, thoughts: 0, output: 0, total: 0 };
    const newPrompt = Math.max(0, tm.totalPromptTokens - tm.totalCachedTokens);
    return {
      cached: tm.totalCachedTokens,
      prompt: newPrompt,
      thoughts: tm.totalThoughtsTokens,
      output: tm.totalCandidatesTokens,
      total: tm.totalTokens,
    };
  }

  private turnTokens(tm: LogTurnTokenMetadata | null): TokenBreakdown {
    if (!tm) return { cached: 0, prompt: 0, thoughts: 0, output: 0, total: 0 };
    const cached = tm.cachedContentTokenCount ?? 0;
    const prompt = Math.max(0, (tm.promptTokenCount ?? 0) - cached);
    return {
      cached,
      prompt,
      thoughts: tm.thoughtsTokenCount ?? 0,
      output: tm.candidatesTokenCount ?? 0,
      total: tm.totalTokenCount ?? 0,
    };
  }

  private renderTokenBar(d: MergedSessionView) {
    const t = this.aggregateTokens(d);
    if (t.total === 0) return nothing;
    return this.renderTokenBarVisual(t, false);
  }

  private renderTokenBarVisual(t: TokenBreakdown, compact: boolean) {
    if (t.total === 0) return nothing;

    // Adaptive scale: smallest tier that fits the actual usage.
    const TIERS = [
      { cap: 50_000, label: "50K" },
      { cap: 250_000, label: "250K" },
      { cap: 1_000_000, label: "1M" },
    ];
    const tier = TIERS.find((t2) => t.total <= t2.cap) ?? TIERS.at(-1)!;
    const scale = tier.cap;

    const pct = (n: number) =>
      `${Math.min((n / scale) * 100, 100).toFixed(2)}%`;
    const fmt = (n: number) =>
      n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

    const segments = [
      { cls: "cached", value: t.cached, label: "cached" },
      { cls: "prompt", value: t.prompt, label: "prompt" },
      { cls: "thoughts", value: t.thoughts, label: "thoughts" },
      { cls: "output", value: t.output, label: "output" },
    ].filter((s) => s.value > 0);

    return html`
      <div class="token-visual ${compact ? "compact" : ""}">
        <div class="token-track">
          <div class="token-segments">
            ${segments.map(
              (s) => html`
                <div
                  class="token-seg ${s.cls}"
                  style="width: ${pct(s.value)}"
                  title="${s.label}: ${s.value.toLocaleString()}"
                ></div>
              `
            )}
          </div>
          <span class="token-scale">${tier.label}</span>
          ${scale === 1_000_000
            ? html`
                <div
                  class="token-tick"
                  style="left: 75%"
                  title="Warning: 750K tokens"
                ></div>
              `
            : nothing}
        </div>
        ${!compact
          ? html`
              <div class="token-legend">
                ${segments.map(
                  (s) => html`
                    <span class="token-legend-item">
                      <span class="dot ${s.cls}"></span>
                      <span class="legend-value">${fmt(s.value)}</span>
                      ${s.label}
                    </span>
                  `
                )}
                <span class="token-legend-total">
                  ${fmt(t.total)} / ${tier.label}
                </span>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderSystemInstruction(seg: SessionSegment | undefined) {
    const text = seg?.config?.systemInstruction?.parts?.[0]?.text;
    if (!text) return nothing;
    return html`
      <details>
        <summary>System Instruction</summary>
        <div class="section-body">${text}</div>
      </details>
    `;
  }

  private renderTools(seg: SessionSegment | undefined) {
    const tools = seg?.config?.tools;
    if (!tools) return nothing;
    const fns = tools.flatMap((t) => t.functionDeclarations ?? []);
    if (fns.length === 0) return nothing;
    return html`
      <details>
        <summary>Tools (${fns.length})</summary>
        <div class="section-body">
          <div class="tools-list">
            ${fns.map((fn) => html`<span class="tool-chip">${fn.name}</span>`)}
          </div>
        </div>
      </details>
    `;
  }

  private renderTimeline(d: MergedSessionView) {
    if (d.segments.length === 0) return nothing;

    const lastSeg = d.segments.at(-1)!;
    const lastEntry = lastSeg.turnGroups.at(-1)?.entries.at(-1);
    const terminationEntry = this.#extractTerminationEntry(lastEntry);

    // If terminated, clone last segment with the termination entry removed.
    const effectiveSegments = terminationEntry
      ? this.#withoutLastEntry(d.segments)
      : d.segments;

    return html`
      <div class="conversation">
        ${effectiveSegments.map((seg) =>
          this.renderSegment(seg, d.segments.length)
        )}
        ${this.#renderStatusDivider(
          terminationEntry ? "terminated" : "suspended"
        )}
        ${terminationEntry ? this.renderTurn(terminationEntry) : nothing}
      </div>
    `;
  }

  private renderSegment(seg: SessionSegment, totalSegments: number) {
    const duration = (seg.totalDurationMs / 1000).toFixed(1);
    const label =
      seg.segmentIndex === 0 ? "Run 1" : `Run ${seg.segmentIndex + 1}`;
    const resumed = seg.segmentIndex > 0 ? " (resumed)" : "";

    return html`
      ${totalSegments > 1
        ? html`
            <div class="segment-block">
              <div class="segment-divider">
                <span class="segment-info">
                  <span class="segment-label">${label}${resumed}</span>
                  <span class="segment-stats">
                    ${duration}s · ${seg.turnCount}
                    turn${seg.turnCount !== 1 ? "s" : ""}
                  </span>
                </span>
              </div>
            </div>
          `
        : nothing}
      ${seg.turnGroups.map((tg) => this.renderTurnGroup(tg, seg))}
    `;
  }

  private renderTurnGroup(tg: TurnGroup, _seg: SessionSegment) {
    const tokens = this.turnTokens(tg.tokenMetadata);

    return html`
      ${tokens.total > 0 ? this.renderTurnHeader(tokens) : nothing}
      ${tg.entries.map((turn) => this.renderTurn(turn))}
    `;
  }

  private renderTurnHeader(t: TokenBreakdown) {
    const TIERS = [
      { cap: 50_000, label: "50K" },
      { cap: 250_000, label: "250K" },
      { cap: 1_000_000, label: "1M" },
    ];
    const tier = TIERS.find((t2) => t.total <= t2.cap) ?? TIERS.at(-1)!;
    const scale = tier.cap;
    const pct = (n: number) =>
      `${Math.min((n / scale) * 100, 100).toFixed(2)}%`;
    const fmt = (n: number) =>
      n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

    const segments = [
      { cls: "cached", value: t.cached, label: "cached" },
      { cls: "prompt", value: t.prompt, label: "prompt" },
      { cls: "thoughts", value: t.thoughts, label: "thoughts" },
      { cls: "output", value: t.output, label: "output" },
    ].filter((s) => s.value > 0);

    return html`
      <div class="turn-header">
        <span class="turn-header-label">turn</span>
        <div class="turn-header-bar">
          <div class="token-segments">
            ${segments.map(
              (s) => html`
                <div
                  class="token-seg ${s.cls}"
                  style="width: ${pct(s.value)}"
                  title="${s.label}: ${s.value.toLocaleString()}"
                ></div>
              `
            )}
          </div>
        </div>
        <span class="turn-header-tokens">
          ${segments.map(
            (s) => html`
              <span class="token-legend-item">
                <span class="dot ${s.cls}"></span>
                <span class="legend-value">${fmt(s.value)}</span>
              </span>
            `
          )}
          <span class="turn-header-total">${fmt(t.total)}</span>
        </span>
      </div>
    `;
  }

  private renderTurn(turn: LogTurn) {
    const role = turn.role || "unknown";
    const parts = (turn.parts || []).filter((p) => !this.isEmptyPart(p));
    if (parts.length === 0) return nothing;

    // Separate context update text parts from everything else.
    const contextParts: LogPart[] = [];
    const otherParts: LogPart[] = [];
    if (role === "user") {
      for (const p of parts) {
        if (p.text && CONTEXT_UPDATE_RE.test(p.text)) {
          contextParts.push(p);
        } else {
          otherParts.push(p);
        }
      }
    } else {
      otherParts.push(...parts);
    }

    // Render context update cards.
    const contextCards = contextParts.map((p) => {
      const match = p.text!.match(CONTEXT_UPDATE_RE);
      const content = match ? match[1].trim() : p.text!;
      const label = html`<span class="role-chip context-update">context update</span>`;
      return html`
        <div class="turn context-update">
          <div class="turn-role">${label}</div>
          <div class="turn-parts">
            <bees-truncated-text fadeBg="#1c1a11">${content}</bees-truncated-text>
          </div>
        </div>
      `;
    });

    if (otherParts.length === 0) {
      return html`${contextCards}`;
    }

    // Function responses are injected by the system, not typed by a person.
    const hasOnlyFunctionResponses =
      role === "user" && otherParts.every((p) => p.functionResponse);

    if (hasOnlyFunctionResponses) {
      return html`${contextCards}${otherParts.map((p) => {
        const name = p.functionResponse!.name;
        const label = html`<span class="role-chip response">response</span> ${name}`;
        return this.#renderCard("system", label, [p]);
      })}`;
    }

    // Model turns: split thoughts and function calls into their own cards.
    if (role === "model") {
      return this.#renderModelTurn(otherParts);
    }

    return html`${contextCards}${this.#renderCard(role, role, otherParts)}`;
  }

  #renderModelTurn(parts: LogPart[]) {
    // Classify each part and render as separate cards.
    type PartKind = "thought" | "call" | "other";
    const classify = (p: LogPart): PartKind => {
      if (p.thought && p.text) return "thought";
      if (p.functionCall) return "call";
      return "other";
    };

    // Group consecutive same-kind parts (but calls are always individual).
    const groups: { kind: PartKind; parts: LogPart[] }[] = [];
    for (const p of parts) {
      const kind = classify(p);
      const last = groups.at(-1);
      if (kind === "other" && last?.kind === "other") {
        last.parts.push(p);
      } else {
        groups.push({ kind, parts: [p] });
      }
    }

    return html`${groups.map((g) => {
      if (g.kind === "thought") {
        return html`${g.parts.map((p) => {
          const { title, body } = this.#parseThought(p.text!);
          const label = title
            ? html`<span class="role-chip thought">thought</span> ${title}`
            : "thought";
          const isLong = body.length > 300;
          return html`
            <div class="turn thought">
              <div class="turn-role">${label}</div>
              <div class="turn-parts">
                <div class="part-thought ${isLong ? "long" : ""}">${body}${isLong ? renderExpandButton() : nothing}</div>
              </div>
            </div>
          `;
        })}`;
      }
      if (g.kind === "call") {
        return html`${g.parts.map((p) => {
          const fc = p.functionCall!;
          const label = html`<span class="role-chip call">call</span> ${fc.name}`;
          return html`
            <div class="turn call">
              <div class="turn-role">${label}</div>
              <div class="turn-parts">
                <div class="json-tree">${renderJson(fc.args)}</div>
              </div>
            </div>
          `;
        })}`;
      }
      return this.#renderCard("model", "model", g.parts);
    })}`;
  }

  #renderCard(roleClass: string, displayRole: unknown, parts: LogPart[]) {
    return html`
      <div class="turn ${roleClass}">
        <div class="turn-role">${displayRole}</div>
        <div class="turn-parts">
          ${parts.map((p) => this.renderPart(p))}
        </div>
      </div>
    `;
  }

  private isEmptyPart(p: LogPart): boolean {
    if (
      p.thoughtSignature &&
      !p.text &&
      !p.functionCall &&
      !p.functionResponse
    ) {
      return true;
    }
    if (
      p.text !== undefined &&
      p.text === "" &&
      !p.functionCall &&
      !p.functionResponse
    ) {
      return true;
    }
    return false;
  }

  private renderPart(p: LogPart) {
    // Thoughts and function calls are handled at the card level.
    if (p.thought && p.text) return nothing;
    if (p.functionCall) return nothing;

    if (p.functionResponse) {
      const fr = p.functionResponse;
      return html`<div class="part-function-response">
        <div class="json-tree">${renderJson(fr.response)}</div>
      </div>`;
    }

    if (p.text) {
      const isLong = p.text.length > 500;
      return html`<div class="part-text ${isLong ? "long" : ""}">${p.text}${isLong ? renderExpandButton() : nothing}</div>`;
    }

    return nothing;
  }

  // ── Thought parsing ──

  #parseThought(text: string): { title: string | null; body: string } {
    const match = text.match(/\*\*(.+?)\*\*/);
    if (!match) return { title: null, body: text };
    const title = match[1];
    const body = text.replace(match[0], "").trim();
    return { title, body };
  }

  // JSON tree rendering and expand/collapse: imported from json-tree.ts

  // ── End-state helpers ──

  #extractTerminationEntry(entry: LogTurn | undefined): LogTurn | null {
    if (!entry) return null;
    const parts = entry.parts || [];
    // Ignore context update text parts when checking for termination.
    const nonContextParts = parts.filter(
      (p) => !(p.text && CONTEXT_UPDATE_RE.test(p.text))
    );
    const isAllFunctionResponses =
      entry.role === "user" &&
      nonContextParts.length > 0 &&
      nonContextParts.every((p) => p.functionResponse);
    if (!isAllFunctionResponses) return null;
    const hasTermination = nonContextParts.some(
      (p) =>
        p.functionResponse && TERMINATION_FUNCTIONS.has(p.functionResponse.name)
    );
    return hasTermination ? entry : null;
  }

  #withoutLastEntry(segments: SessionSegment[]): SessionSegment[] {
    const lastSeg = segments.at(-1)!;
    const lastTg = lastSeg.turnGroups.at(-1)!;
    const modifiedTg = { ...lastTg, entries: lastTg.entries.slice(0, -1) };
    return [
      ...segments.slice(0, -1),
      {
        ...lastSeg,
        turnGroups: [...lastSeg.turnGroups.slice(0, -1), modifiedTg],
      },
    ];
  }

  #renderStatusDivider(status: "suspended" | "terminated") {
    const label = status === "suspended" ? "Suspended" : "Terminated";
    return html`
      <div class="segment-block">
        <div class="segment-divider">
          <span class="segment-info">
            <span class="segment-label">${label}</span>
          </span>
        </div>
      </div>
    `;
  }

  #dispatchNavigate(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-log-detail": BeesLogDetail;
  }
}
