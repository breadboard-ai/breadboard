/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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
import { SessionStoreReader, compileEventsToSegment } from "../data/session-store-reader.js";
import type { TurnCheckpointInfo, SessionLineageInfo, TaskCompletionInfo } from "../data/session-store-reader.js";
import type { StateAccess } from "../data/state-access.js";
import type { TicketStore } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import { logDetailStyles } from "./log-detail.styles.js";
import "./primitives/confirm-dialog.js";

export { BeesLogDetail };

interface InteractionStateDto {
  file_system?: {
    files?: Record<string, unknown>;
  };
  function_call_part?: {
    functionCall?: {
      name?: string;
    };
  };
  contents?: Array<unknown>;
}

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
class BeesLogDetail extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor data: MergedSessionView | null = null;

  @property({ attribute: false })
  accessor stateAccess: StateAccess | null = null;

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @property({ type: String })
  accessor sessionId: string | null = null;

  @state() accessor storeData: MergedSessionView | null = null;
  @state() accessor interactionSummary: { contextCount: number; pendingCall?: string; fsSize: number } | null = null;
  @state() accessor turns: TurnCheckpointInfo[] = [];
  @state() accessor ticketId: string | null = null;
  @state() accessor activeSessionId: string | null = null;
  @state() accessor showConfirmDialog = false;
  @state() accessor confirmMessage = "";
  @state() accessor rollbackTurnIndex = -1;
  @state() accessor lineage: SessionLineageInfo[] = [];

  static styles = [logDetailStyles];

  #rollbackSourceSessionId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);

    if (this.#rollbackSourceSessionId && this.activeTicket) {
      const currentActive = this.activeTicket.active_session;
      if (currentActive && currentActive !== this.#rollbackSourceSessionId) {
        const newActive = currentActive;
        this.#rollbackSourceSessionId = null;
        
        // Auto-navigate Hivetool to the newly forked active session
        this.#dispatchNavigate("logs", newActive);
      }
    }
  }

  #sessionReader: SessionStoreReader | null = null;

  get sessionReader() {
    if (!this.#sessionReader && this.stateAccess) {
      this.#sessionReader = new SessionStoreReader(this.stateAccess);
    }
    return this.#sessionReader;
  }

  #loadedSessionId: string | null = null;
  #lastReloadedTimestamp = 0;

  private async loadSessionData(sessionId: string) {
    if (!this.sessionReader || !this.ticketStore) return;

    let ticketId: string | null = null;
    let resolvedSessionId: string | null = null;

    // Resolving if sessionId is the ticket ID or active session UUID
    const tickets = this.ticketStore.tickets.get();
    const ticketByTaskId = tickets.find((t) => t.id === sessionId);
    if (ticketByTaskId) {
      ticketId = sessionId;
      resolvedSessionId = ticketByTaskId.active_session || null;
    } else {
      ticketId = await this.sessionReader.findTicketForSession(sessionId);
      resolvedSessionId = sessionId;
    }

    if (!ticketId || !resolvedSessionId) {
      this.ticketId = null;
      this.activeSessionId = null;
      this.storeData = null;
      this.interactionSummary = null;
      this.turns = [];
      return;
    }

    this.ticketId = ticketId;
    this.activeSessionId = resolvedSessionId;

    const lineage = await this.sessionReader.readLineage(ticketId);
    this.lineage = lineage;

    const events = await this.sessionReader.readEvents(ticketId, resolvedSessionId);
    const interaction = await this.sessionReader.readInteraction(ticketId, resolvedSessionId) as InteractionStateDto | null;
    const turns = await this.sessionReader.readTurns(ticketId, resolvedSessionId);

    this.turns = turns;

    if (events.length > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      const segment = compileEventsToSegment(resolvedSessionId, events as Record<string, unknown>[], ticket?.runner);
      this.storeData = {
        sessionId: resolvedSessionId,
        segments: [segment],
        totalDurationMs: 0,
        totalTurns: segment.turnCount,
        totalThoughts: segment.totalThoughts,
        totalFunctionCalls: segment.totalFunctionCalls,
        totalTokens: segment.totalTokens
      };
    } else {
      this.storeData = null;
    }

    if (interaction) {
      const files = interaction.file_system?.files || {};
      const fc = interaction.function_call_part?.functionCall || {};
      this.interactionSummary = {
        contextCount: interaction.contents?.length ?? 0,
        pendingCall: fc.name || undefined,
        fsSize: Object.keys(files).length
      };
    } else {
      this.interactionSummary = null;
    }
  }

  render() {
    // Access recentlyUpdatedTicket signal to establish a reactive subscription
    const updated = this.ticketStore?.recentlyUpdatedTicket.get();
    if (updated && this.ticketId && updated.id === this.ticketId && this.sessionId) {
      if (this.#lastReloadedTimestamp !== updated.at) {
        this.#lastReloadedTimestamp = updated.at;
        this.loadSessionData(this.sessionId);
      }
    }

    if (this.sessionId && this.#loadedSessionId !== this.sessionId) {
      this.storeData = null;
      this.interactionSummary = null;
      this.turns = [];
      this.activeSessionId = null;
      this.#loadedSessionId = this.sessionId;
      this.loadSessionData(this.sessionId);
    }

    const effectiveData = this.storeData || this.data;

    if (!effectiveData) {
      return html`<div class="empty">Select a log entry to inspect.</div>`;
    }
    const d = effectiveData;
    const firstSegment = d.segments[0];

    return html`
      ${this.renderHeader(d)}
      ${this.renderInteractionSummary()}
      ${this.renderTokenBar(d)}
      <div class="sections">
        ${this.renderSystemInstruction(firstSegment)}
        ${this.renderTools(firstSegment)}
      </div>
      ${this.renderTimeline(d)}
      <bees-confirm-dialog
        .open=${this.showConfirmDialog}
        .title=${"Confirm Session Rewind"}
        .message=${this.confirmMessage}
        .confirmLabel=${"Rewind"}
        .cancelLabel=${"Cancel"}
        @confirm=${this.executeRollback}
        @cancel=${this.closeConfirmDialog}
      ></bees-confirm-dialog>
    `;
  }

  private renderInteractionSummary() {
    const s = this.interactionSummary;
    if (!s) return nothing;
    return html`
      <div class="interaction-block">
        <div class="interaction-block-header">Active Interaction Snapshot</div>
        <div class="interaction-block-content">
          <div><strong>Conversation:</strong> ${s.contextCount} entries</div>
          <div><strong>Workspace:</strong> ${s.fsSize} files</div>
          ${s.pendingCall ? html`<div><strong>Suspended On:</strong> <code class="mono">${s.pendingCall}</code></div>` : nothing}
        </div>
      </div>
    `;
  }

  private renderHeader(d: MergedSessionView) {
    const duration = (d.totalDurationMs / 1000).toFixed(1);
    const started = d.segments[0]?.startedDateTime;
    const tId = this.ticketId || d.sessionId;
    return html`
      <div class="header">
        <div class="header-top">
          <h2>
            Session
            <code class="mono">${d.sessionId.slice(0, 13)}…</code>
          </h2>
          <span
            class="link-chip"
            @click=${() => this.#dispatchNavigate("ticket", tId)}
          >
            <span class="link-chip-label">task</span>
            ${tId.slice(0, 8)}
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
    const checkpoint = this.turns.find((cp) => cp.turn === tg.turnIndex);
    const tokens = this.turnTokens(tg.tokenMetadata || (checkpoint?.token_metadata as unknown as LogTurnTokenMetadata) || null);

    const currentSession = this.lineage.find((l) => l.sessionId === this.activeSessionId);
    const isInherited = !!(currentSession?.forkedFrom && tg.turnIndex < currentSession.forkedFrom.at_turn);

    return html`
      ${tokens.total > 0 || checkpoint ? this.renderTurnHeader(tokens, checkpoint, isInherited) : nothing}
      ${tg.entries.map((turn) => this.renderTurn(turn, isInherited))}
    `;
  }

  private renderTurnHeader(t: TokenBreakdown, checkpoint?: TurnCheckpointInfo, isInherited = false) {
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

    const fsInfo = checkpoint?.file_system;
    const fileCount = fsInfo ? (fsInfo as unknown as { file_count?: number }).file_count ?? null : null;

    return html`
      <div class="turn-header">
        <span class="turn-header-label">turn ${checkpoint ? checkpoint.turn + 1 : ""}</span>
        ${isInherited ? html`<span class="role-chip inherited" style="margin-left: 8px">🧬 Cloned</span>` : nothing}
        ${this.canRollback() && checkpoint ? html`
          <button
            class="rollback-btn"
            @click=${() => this.handleRollback(checkpoint.turn)}
            title="Rollback session to the start of this turn"
          >
            ⏪ Rewind
          </button>
        ` : nothing}
        ${fileCount !== null ? html`
          <span class="turn-header-fs" style="margin-left: 12px; font-size: 11px; color: #475569; display: inline-flex; align-items: center; gap: 4px">
            📂 ${fileCount} file${fileCount !== 1 ? "s" : ""}
          </span>
        ` : nothing}
        <div class="turn-header-bar" style="margin-left: 12px">
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

  private renderTurn(turn: LogTurn, isInherited = false) {
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
        <div class="turn context-update ${isInherited ? "inherited" : ""}">
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
        return this.#renderCard("system", label, [p], isInherited);
      })}`;
    }

    // Model turns: split thoughts and function calls into their own cards.
    if (role === "model") {
      return this.#renderModelTurn(otherParts, isInherited);
    }

    return html`${contextCards}${this.#renderCard(role, role, otherParts, isInherited)}`;
  }

  #renderModelTurn(parts: LogPart[], isInherited = false) {
    // Classify each part and render as separate cards.
    type PartKind = "thought" | "call" | "systemMessage" | "other";
    const classify = (p: LogPart): PartKind => {
      if (p.systemMessage && p.text) return "systemMessage";
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
      if (g.kind === "systemMessage") {
        return html`${g.parts.map((p) => {
          const label = html`<span class="role-chip system-message">system</span>`;
          return html`
            <div class="turn system-message ${isInherited ? "inherited" : ""}">
              <div class="turn-role">${label}</div>
              <div class="turn-parts">
                <div class="part-system-message">${p.text}</div>
              </div>
            </div>
          `;
        })}`;
      }
      if (g.kind === "thought") {
        return html`${g.parts.map((p) => {
          const { title, body } = this.#parseThought(p.text!);
          const label = title
            ? html`<span class="role-chip thought">thought</span> ${title}`
            : "thought";
          const isLong = body.length > 300;
          return html`
            <div class="turn thought ${isInherited ? "inherited" : ""}">
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
            <div class="turn call ${isInherited ? "inherited" : ""}">
              <div class="turn-role">${label}</div>
              <div class="turn-parts">
                <div class="json-tree">${renderJson(fc.args)}</div>
              </div>
            </div>
          `;
        })}`;
      }
      return this.#renderCard("model", "model", g.parts, isInherited);
    })}`;
  }

  #renderCard(roleClass: string, displayRole: unknown, parts: LogPart[], isInherited = false) {
    return html`
      <div class="turn ${roleClass} ${isInherited ? "inherited" : ""}">
        <div class="turn-role">${displayRole}</div>
        <div class="turn-parts">
          ${parts.map((p) => this.renderPart(p))}
        </div>
      </div>
    `;
  }

  private isEmptyPart(p: LogPart): boolean {
    if (p.inlineData) return false;
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
    if (p.systemMessage && p.text) return nothing;
    if (p.functionCall) return nothing;

    if (p.functionResponse) {
      const fr = p.functionResponse;
      return html`<div class="part-function-response">
        <div class="json-tree">${renderJson(fr.response)}</div>
      </div>`;
    }

    if (p.inlineData) {
      if (p.inlineData.mimeType.startsWith("image/")) {
        return html`<div class="part-image"><img src="data:${p.inlineData.mimeType};base64,${p.inlineData.data}" alt="Generated Image" style="max-width: 100%; border-radius: 8px; margin-top: 8px;" /></div>`;
      }
      if (p.inlineData.mimeType.startsWith("video/")) {
        return html`<div class="part-video"><video src="data:${p.inlineData.mimeType};base64,${p.inlineData.data}" controls style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;"></video></div>`;
      }
      if (p.inlineData.mimeType.startsWith("audio/")) {
        return html`<div class="part-audio"><audio src="data:${p.inlineData.mimeType};base64,${p.inlineData.data}" controls style="max-width: 100%; margin-top: 8px; display: block;"></audio></div>`;
      }
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

  private get activeTicket() {
    if (!this.ticketStore || !this.ticketId) return null;
    return this.ticketStore.tickets.get().find((t) => t.id === this.ticketId) || null;
  }

  private canRollback() {
    const boxActive = this.mutationClient?.boxActive.get();
    const ticket = this.activeTicket;
    if (!boxActive) return false;
    if (!ticket) return false;
    return ticket.status === "suspended";
  }

  private async handleRollback(turnIndex: number) {
    if (!this.mutationClient || !this.ticketId) return;

    this.rollbackTurnIndex = turnIndex;

    // Check for tasks that would be re-queued (infinite agents).
    let requeueMessage = "";
    if (this.sessionReader && this.activeSessionId) {
      const completions = await this.sessionReader.readTaskCompletions(
        this.ticketId, this.activeSessionId
      );
      const requeued = completions.filter((c) => c.turn > turnIndex);
      if (requeued.length > 0) {
        const taskIds = requeued.map((c) => c.task_id.slice(0, 8));
        requeueMessage =
          ` ${requeued.length} completed task${requeued.length > 1 ? "s" : ""}` +
          ` will be re-queued: ${taskIds.join(", ")}.`;
      }
    }

    this.confirmMessage =
      `Fork at turn ${turnIndex + 1}? A new session will be created and turns ` +
      `${turnIndex + 2} onwards will be preserved in the superseded session.` +
      requeueMessage;
    this.showConfirmDialog = true;
  }

  private async executeRollback() {
    if (!this.mutationClient || !this.ticketId || this.rollbackTurnIndex === -1) return;

    const turnIndex = this.rollbackTurnIndex;
    this.showConfirmDialog = false;
    this.rollbackTurnIndex = -1;

    try {
      this.#rollbackSourceSessionId = this.activeSessionId;
      await this.mutationClient.rollbackToTurn(this.ticketId, turnIndex, this.activeSessionId ?? undefined);
    } catch (e) {
      this.#rollbackSourceSessionId = null;
      console.error("Failed to rollback to turn:", e);
    }
  }

  private closeConfirmDialog() {
    this.showConfirmDialog = false;
    this.rollbackTurnIndex = -1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-log-detail": BeesLogDetail;
  }
}
