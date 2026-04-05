/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type {
  MergedSessionView,
  SessionSegment,
  LogPart,
  LogTurn,
} from "../data/types.js";
import { logDetailStyles } from "./log-detail.styles.js";

export { BeesLogDetail };

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
    return html`
      <div class="conversation">
        <div class="conversation-label">Conversation</div>
        ${d.segments.map((seg) => this.renderSegment(seg, d.segments.length))}
      </div>
    `;
  }

  private renderSegment(seg: SessionSegment, totalSegments: number) {
    const duration = (seg.totalDurationMs / 1000).toFixed(1);
    const label =
      seg.segmentIndex === 0 ? "Run 1" : `Run ${seg.segmentIndex + 1}`;
    const resumed = seg.segmentIndex > 0 ? " (resumed)" : "";
    const tokens = this.segmentTokens(seg);

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
              ${this.renderTokenBarVisual(tokens, true)}
            </div>
          `
        : nothing}
      ${seg.newTurns.map((turn) => this.renderTurn(turn))}
    `;
  }

  private renderTurn(turn: LogTurn) {
    const role = turn.role || "unknown";
    const parts = (turn.parts || []).filter((p) => !this.isEmptyPart(p));
    if (parts.length === 0) return nothing;

    return html`
      <div class="turn ${role}">
        <div class="turn-role">${role}</div>
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
    if (p.thought && p.text) {
      const isLong = p.text.length > 300;
      return html`<div class="part-thought ${isLong ? "long" : ""}">
        ${p.text}
      </div>`;
    }

    if (p.functionCall) {
      const fc = p.functionCall;
      const argsStr = JSON.stringify(fc.args);
      const argsPreview =
        argsStr.length > 80 ? argsStr.slice(0, 80) + "…" : argsStr;
      return html`<div class="part-function-call">
        <span class="fn-badge">🔧 ${fc.name}</span>
        <span class="fn-args">${argsPreview}</span>
      </div>`;
    }

    if (p.functionResponse) {
      const fr = p.functionResponse;
      const respStr = JSON.stringify(fr.response, null, 2);
      const preview =
        respStr.length > 500 ? respStr.slice(0, 500) + "\n…" : respStr;
      return html`<div class="part-function-response">
        <div class="fn-response-name">← ${fr.name}</div>
        ${preview}
      </div>`;
    }

    if (p.text) {
      const isLong = p.text.length > 500;
      return html`<div class="part-text ${isLong ? "long" : ""}">
        ${p.text}
      </div>`;
    }

    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-log-detail": BeesLogDetail;
  }
}
