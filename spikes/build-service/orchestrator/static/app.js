/* global document, window, console, fetch, setTimeout, EventSource */
// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Ticket Pipeline — task-as-journey frontend.
 *
 * Mental model:
 *   A root ticket (ui_request) = a user TASK.
 *   Sub-tickets (generation, build, review) = internal log entries.
 *
 * Task view: user-facing.
 *   - Empty → centered prompt
 *   - Has tasks → card list
 *   - Click card → latest output + review actions
 *
 * Debug view: orchestration log.
 *   - Root tasks as expandable rows
 *   - Sub-tickets as timestamped log entries
 */

// ─── State ──────────────────────────────────────────────────────────────────

/** @type {Map<number, object>} */
const tickets = new Map();

/** Currently viewed task ID in detail. */
let activeTaskId = null;

/** If true, show the inline "new task" prompt. */
let showNewPrompt = false;

/** Cached tokens CSS for iframe injection. */
let tokensCSSCache = null;

// ─── Elements ───────────────────────────────────────────────────────────────

const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const ticketCountBadge = document.getElementById("ticket-count");
const taskView = document.getElementById("view-task");
const ticketsView = document.getElementById("view-tickets");

// ─── View Router ────────────────────────────────────────────────────────────

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    views.forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  });
});

// ─── SSE ────────────────────────────────────────────────────────────────────

function connectSSE() {
  const source = new EventSource("/events");

  source.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.action === "init") {
      for (const t of data.tickets) tickets.set(t.id, t);
    } else if (data.ticket) {
      tickets.set(data.ticket.id, data.ticket);

      // Auto-follow begat tasks.
      if (
        data.action === "created" &&
        data.ticket.type === "ui_request" &&
        data.ticket.metadata?.predecessor_id
      ) {
        activeTaskId = data.ticket.id;
      }
    }

    render();
  };

  source.onerror = () => {
    source.close();
    setTimeout(connectSSE, 2000);
  };
}

connectSSE();

// ─── Design Tokens ──────────────────────────────────────────────────────────

async function loadTokensCSS() {
  if (tokensCSSCache !== null) return tokensCSSCache;
  try {
    const res = await fetch("/tokens.css");
    tokensCSSCache = await res.text();
  } catch {
    tokensCSSCache = "";
  }
  return tokensCSSCache;
}

loadTokensCSS();

// ─── API Actions ────────────────────────────────────────────────────────────

async function submitPrompt(prompt) {
  try {
    const res = await fetch("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    activeTaskId = data.root_ticket_id;
    showNewPrompt = false;
    render();
  } catch (err) {
    console.error("Submit failed:", err);
  }
}

async function approveTicket(id) {
  await fetch(`/tickets/${id}/approve`, { method: "POST" });
}

async function denyTicket(id) {
  const input = document.getElementById(`feedback-${id}`);
  const feedback = input?.value || "";
  await fetch(`/tickets/${id}/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "User rejected", feedback }),
  });
}

// Expose to onclick handlers.
window.submitPrompt = submitPrompt;
window.approveTicket = approveTicket;
window.denyTicket = denyTicket;

// ─── Helpers ────────────────────────────────────────────────────────────────

function rootTasks() {
  return [...tickets.values()]
    .filter((t) => t.type === "ui_request")
    .sort((a, b) => b.created_at - a.created_at);
}

function childrenOf(rootId) {
  return [...tickets.values()]
    .filter((t) => t.parent_id === rootId)
    .sort((a, b) => a.created_at - b.created_at);
}

function taskStatus(root) {
  if (root.status === "superseded") return "superseded";
  if (root.status === "resolved") return "done";
  const kids = childrenOf(root.id);
  const review = kids.find(
    (c) => c.type === "ui_review" && c.status === "awaiting_approval"
  );
  if (review) return "review";
  if (kids.some((c) => c.status === "in_progress" || c.status === "open"))
    return "working";
  return "open";
}

function statusLabel(s) {
  const labels = {
    working: "In progress",
    review: "Awaiting review",
    done: "Complete",
    superseded: "Superseded",
    open: "Open",
  };
  return labels[s] || s;
}

function rawStatusLabel(s) {
  return s.replace(/_/g, " ");
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateTime(ts) {
  const d = new Date(ts * 1000);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  );
}

function assigneeIcon(name) {
  if (!name) return "";
  const key = name.toLowerCase();
  let cls = "user";
  if (key === "gemini") cls = "gemini";
  else if (key.includes("build")) cls = "build";
  return `<span class="assignee-icon ${cls}">${name[0]}</span>`;
}

function escapeHTML(str) {
  const el = document.createElement("span");
  el.textContent = str || "";
  return el.innerHTML;
}

// ─── Iframe Rendering ───────────────────────────────────────────────────────

function buildIframeHTML(cjs, tokensCSS = "") {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1" rel="stylesheet">
  <style>
    ${tokensCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; }
    body {
      font-family: var(--cg-font-sans, system-ui, sans-serif);
      background: var(--cg-color-surface, #fcfcfc);
      color: var(--cg-color-on-surface, #1c1c1e);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    try {
      const module = { exports: {} };
      const exports = module.exports;
      const require = (name) => {
        if (name === 'react') return React;
        if (name === 'react-dom') return ReactDOM;
        throw new Error('Unknown module: ' + name);
      };
      ${cjs}
      const Component = module.exports.default || module.exports;
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(Component));
    } catch (e) {
      document.getElementById('root').innerHTML =
        '<pre style="color:red;padding:1rem">' + e.message + '\\n' + e.stack + '</pre>';
    }
  </script>
</body>
</html>`;
}

async function renderBundleInIframe(ticketId, iframeEl) {
  const tokensCSS = await loadTokensCSS();
  try {
    const res = await fetch(`/tickets/${ticketId}/bundle`);
    const data = await res.json();
    if (data.code && iframeEl) {
      iframeEl.srcdoc = buildIframeHTML(data.code, tokensCSS);
    }
  } catch (err) {
    console.error("Preview failed:", err);
  }
}

// ─── Task View ──────────────────────────────────────────────────────────────

function renderTaskView() {
  const roots = rootTasks();

  // No tasks → empty prompt.
  if (roots.length === 0 && !showNewPrompt) {
    taskView.innerHTML = `
      <div class="task-empty">
        <h2>What do you want?</h2>
        <form class="prompt-form" onsubmit="event.preventDefault();const t=this.querySelector('textarea');submitPrompt(t.value.trim());t.value='';">
          <textarea placeholder="Describe the UI you want to build..." rows="4" autofocus></textarea>
          <button type="submit" class="btn-primary">
            <span class="material-symbols-outlined icon">send</span>
            Create
          </button>
        </form>
      </div>
    `;
    return;
  }

  // Task detail view.
  if (activeTaskId !== null) {
    renderTaskDetail();
    return;
  }

  // Task card list.
  const promptForm = showNewPrompt
    ? `<div class="task-inline-prompt">
        <textarea placeholder="What do you want?" rows="3" autofocus
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitPrompt(this.value.trim());this.value='';}"
        ></textarea>
        <div class="form-actions">
          <button class="btn-sm ghost" onclick="window._hideNewPrompt()">Cancel</button>
          <button class="btn-sm primary" onclick="const t=this.closest('.task-inline-prompt').querySelector('textarea');submitPrompt(t.value.trim());t.value='';">Create</button>
        </div>
      </div>`
    : "";

  const cards = roots.map((root) => {
    const status = taskStatus(root);
    const prompt =
      root.metadata?.prompt || root.metadata?.original_prompt || root.body;
    const kids = childrenOf(root.id);
    const stepCount = kids.length;

    return `
      <div class="task-card ${status === "superseded" ? "superseded" : ""}" onclick="window._openTask(${root.id})">
        <div class="task-card-status ${status}"></div>
        <div class="task-card-body">
          <div class="task-card-prompt">${escapeHTML(prompt)}</div>
          <div class="task-card-meta">
            <span>${statusLabel(status)}</span>
            <span>·</span>
            <span>${stepCount} step${stepCount !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>${formatDateTime(root.created_at)}</span>
          </div>
        </div>
        <span class="material-symbols-outlined task-card-arrow">chevron_right</span>
      </div>
    `;
  });

  taskView.innerHTML = `
    <div class="task-list-area">
      <div class="task-list-header">
        <h3>Your tasks</h3>
        <button class="btn-new" onclick="window._showNewPrompt()">
          <span class="material-symbols-outlined icon">add</span>
          New
        </button>
      </div>
      <div class="task-cards">
        ${promptForm}
        ${cards.join("")}
      </div>
    </div>
  `;
}

window._openTask = function (id) {
  activeTaskId = id;
  render();
};

window._closeTask = function () {
  activeTaskId = null;
  render();
};

window._showNewPrompt = function () {
  showNewPrompt = true;
  render();
  // Focus the textarea.
  setTimeout(() => {
    const ta = taskView.querySelector(".task-inline-prompt textarea");
    if (ta) ta.focus();
  }, 50);
};

window._hideNewPrompt = function () {
  showNewPrompt = false;
  render();
};

window._showFeedback = function (reviewId) {
  const banner = document.querySelector(".review-banner");
  if (!banner) return;
  banner.innerHTML = `
    <span class="label">What should change?</span>
    <div class="feedback-form">
      <input type="text" id="feedback-${reviewId}" placeholder="e.g. make the button bigger..."
        onkeydown="if(event.key==='Enter'){denyTicket(${reviewId});}" autofocus>
      <button class="btn btn-redo" onclick="denyTicket(${reviewId})">Send</button>
    </div>
  `;
  document.getElementById(`feedback-${reviewId}`)?.focus();
};

function renderTaskDetail() {
  const root = tickets.get(activeTaskId);
  if (!root) {
    activeTaskId = null;
    renderTaskView();
    return;
  }

  const kids = childrenOf(root.id);
  const status = taskStatus(root);
  const prompt =
    root.metadata?.prompt || root.metadata?.original_prompt || root.body;

  // Find review ticket for actions.
  const review = kids.find(
    (c) => c.type === "ui_review" && c.status === "awaiting_approval"
  );

  // Find latest resolved build for preview.
  const buildTicket = kids.find(
    (c) => c.type === "ui_build" && c.status === "resolved"
  );

  // Progress info.
  const activeStep = kids.find(
    (c) => c.status === "in_progress" || c.status === "open"
  );

  let progressHTML = "";
  if (status === "working" && activeStep) {
    const stepLabel = activeStep.type.replace(/_/g, " ");
    const lastEvent = activeStep.events.length
      ? activeStep.events[activeStep.events.length - 1].detail
      : "";
    progressHTML = `
      <div class="task-progress-bar">
        <span class="spinner-sm"></span>
        <span class="progress-text">${escapeHTML(stepLabel)}</span>
        ${lastEvent ? `<span style="color:var(--text-dim)">${escapeHTML(lastEvent)}</span>` : ""}
      </div>
    `;
  }

  let reviewHTML = "";
  if (review) {
    reviewHTML = `
      <div class="review-banner">
        <span class="label">
          <span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">rate_review</span>
          Happy with this result?
        </span>
        <button class="btn btn-accept" onclick="approveTicket(${review.id})">
          <span class="material-symbols-outlined" style="font-size:14px">check</span>
          Accept
        </button>
        <button class="btn btn-redo" onclick="window._showFeedback(${review.id})">
          <span class="material-symbols-outlined" style="font-size:14px">refresh</span>
          Redo
        </button>
      </div>
    `;
  }

  let previewHTML = "";
  if (buildTicket) {
    previewHTML = `
      <div class="task-preview">
        <iframe id="task-detail-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>
    `;
  } else if (status === "working") {
    previewHTML = `
      <div class="task-preview">
        <div class="task-preview-empty">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:0.15">hourglass_top</span>
          <p>Working on it...</p>
        </div>
      </div>
    `;
  } else if (status === "done") {
    previewHTML = `
      <div class="task-preview">
        <div class="task-preview-empty">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:0.15">check_circle</span>
          <p>Task complete.</p>
        </div>
      </div>
    `;
  } else {
    previewHTML = `
      <div class="task-preview">
        <div class="task-preview-empty">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:0.15">hourglass_empty</span>
          <p>Waiting to start...</p>
        </div>
      </div>
    `;
  }

  taskView.innerHTML = `
    <div class="task-detail-area">
      <div class="task-detail-topbar">
        <button class="back-btn" onclick="window._closeTask()">
          <span class="material-symbols-outlined icon">arrow_back</span>
          Tasks
        </button>
        <span class="task-detail-title">${escapeHTML(prompt)}</span>
        <span class="task-detail-status-text">${statusLabel(status)}</span>
      </div>
      ${progressHTML}
      ${reviewHTML}
      ${previewHTML}
    </div>
  `;

  // Load build preview.
  if (buildTicket) {
    const iframe = document.getElementById("task-detail-iframe");
    if (iframe) renderBundleInIframe(buildTicket.id, iframe);
  }
}

// ─── Debug View (Issue Tracker) ─────────────────────────────────────────────

/** Currently viewed ticket in the debug tracker. */
let activeDebugTicketId = null;

function ticketPriority(root) {
  const kids = childrenOf(root.id);
  if (kids.some((c) => c.status === "denied")) return "critical";
  if (root.status === "superseded") return "low";
  if (kids.length > 2) return "high";
  return "medium";
}

function ticketAssignee(root) {
  const kids = childrenOf(root.id);
  // Latest active child's assignee, or fallback to "User".
  for (let i = kids.length - 1; i >= 0; i--) {
    if (kids[i].assigned_to) return kids[i].assigned_to;
  }
  return root.assigned_to || "User";
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatFullDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function activityDotType(child) {
  if (child.type === "ui_generation") return "generation";
  if (child.type === "ui_build") return "build";
  if (child.type === "ui_review") return "review";
  return "status";
}

function activityIcon(type) {
  const icons = {
    generation: "auto_awesome",
    build: "build",
    review: "rate_review",
    status: "info",
  };
  return icons[type] || "info";
}

function activityActor(child) {
  return child.assigned_to || "System";
}

function activityVerb(child) {
  const verbs = {
    ui_generation: "started generation",
    ui_build: "triggered build",
    ui_review: "opened review",
  };
  return verbs[child.type] || "updated ticket";
}

function renderDebugView() {
  const roots = rootTasks();
  ticketCountBadge.textContent = tickets.size;

  // Ticket detail mode.
  if (activeDebugTicketId !== null) {
    renderTicketDetail(activeDebugTicketId);
    return;
  }

  // Card list mode.
  if (roots.length === 0) {
    ticketsView.innerHTML = `
      <div class="tracker-empty">
        <span class="material-symbols-outlined" style="font-size:56px;opacity:0.12">bug_report</span>
        <p>No tickets yet. Create a task to get started.</p>
      </div>
    `;
    return;
  }

  const cards = roots
    .map((root) => {
      const status = taskStatus(root);
      const prompt =
        root.metadata?.prompt || root.metadata?.original_prompt || root.body;
      const priority = ticketPriority(root);
      const assignee = ticketAssignee(root);
      const kids = childrenOf(root.id);
      const subtitle =
        kids.length > 0
          ? `${kids.length} step${kids.length !== 1 ? "s" : ""} · ${statusLabel(status)}`
          : statusLabel(status);

      return `
        <div class="tracker-card ${root.status === "superseded" ? "superseded" : ""}"
             onclick="window._openTicket(${root.id})">
          <span class="tracker-id">#${root.id}</span>
          <div class="tracker-desc">
            <div class="tracker-desc-title">${escapeHTML(prompt)}</div>
            <div class="tracker-desc-sub">${escapeHTML(subtitle)}</div>
          </div>
          <span class="status-pill ${root.status}">${rawStatusLabel(root.status)}</span>
          <span class="priority-dot ${priority}">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
          <div class="assignee-cell">
            ${assigneeIcon(assignee)}
            <span class="assignee-name">${escapeHTML(assignee)}</span>
          </div>
          <span class="tracker-date">${formatDate(root.created_at)}</span>
        </div>
      `;
    })
    .join("");

  ticketsView.innerHTML = `
    <div class="tracker-header">
      <div>
        <h2>Tickets</h2>
        <p>Orchestration log for all tasks.</p>
      </div>
    </div>
    <div class="tracker-list">${cards}</div>
  `;
}

function renderTicketDetail(ticketId) {
  const root = tickets.get(ticketId);
  if (!root) {
    activeDebugTicketId = null;
    renderDebugView();
    return;
  }

  const prompt =
    root.metadata?.prompt || root.metadata?.original_prompt || root.body;
  const kids = childrenOf(root.id);
  const priority = ticketPriority(root);
  const assignee = ticketAssignee(root);
  const predecessorId = root.metadata?.predecessor_id;

  // Build activity feed items.
  const activityItems = [];

  // Opening item.
  activityItems.push(`
    <div class="activity-item">
      <div class="activity-dot status">
        <span class="material-symbols-outlined" style="font-size:14px">add_circle</span>
      </div>
      <div class="activity-card">
        <div class="activity-header">
          <span class="activity-actor">User</span>
          <span class="activity-action">created ticket</span>
          <span class="activity-time">${formatTime(root.created_at)}</span>
        </div>
        <div class="activity-body">
          <div class="activity-desc">${escapeHTML(prompt)}</div>
        </div>
      </div>
    </div>
  `);

  // Sub-ticket activity.
  for (const child of kids) {
    const dotType = activityDotType(child);
    const icon = activityIcon(dotType);
    const actor = activityActor(child);
    const verb = activityVerb(child);
    const evtId = `events-${child.id}`;

    // Collapsible events log.
    let eventsHTML = "";
    if (child.events && child.events.length > 0) {
      const eventLines = child.events
        .map(
          (e) =>
            `<div class="activity-event-line">
               <span class="activity-event-time">${formatTime(e.timestamp)}</span>
               <span class="activity-event-text">${escapeHTML(e.action)}: ${escapeHTML(e.detail)}</span>
             </div>`
        )
        .join("");
      eventsHTML = `
        <button class="activity-events-toggle" onclick="window._toggleEvents('${evtId}', this)">
          <span class="material-symbols-outlined icon">expand_more</span>
          ${child.events.length} event${child.events.length !== 1 ? "s" : ""}
        </button>
        <div class="activity-events" id="${evtId}">${eventLines}</div>
      `;
    }

    // Build preview.
    const isBuild = child.type === "ui_build" && child.status === "resolved";
    const previewId = `activity-preview-${child.id}`;
    const previewHTML = isBuild
      ? `<div class="activity-preview">
           <iframe id="${previewId}" sandbox="allow-scripts allow-same-origin"></iframe>
         </div>`
      : "";

    // File attachments.
    let filesHTML = "";
    if (child.type === "ui_generation" && child.metadata?.generated_files) {
      const files = child.metadata.generated_files;
      const fileTags = (Array.isArray(files) ? files : [])
        .map((f) => `<span class="activity-file">${escapeHTML(f)}</span>`)
        .join("");
      if (fileTags) {
        filesHTML = `<div class="activity-file-list">${fileTags}</div>`;
      }
    }

    activityItems.push(`
      <div class="activity-item">
        <div class="activity-dot ${dotType}">
          <span class="material-symbols-outlined" style="font-size:14px">${icon}</span>
        </div>
        <div class="activity-card">
          <div class="activity-header">
            <span class="activity-actor">${escapeHTML(actor)}</span>
            <span class="activity-action">${escapeHTML(verb)}</span>
            <span class="activity-time">${formatTime(child.created_at)}</span>
          </div>
          <div class="activity-body">
            <div class="activity-desc">${escapeHTML(child.body)}</div>
            <div class="activity-meta">
              <span class="status-pill ${child.status}">${rawStatusLabel(child.status)}</span>
            </div>
            ${filesHTML}
            ${eventsHTML}
            ${previewHTML}
          </div>
        </div>
      </div>
    `);
  }

  // Sidebar metadata.
  let lineageHTML = "";
  if (predecessorId) {
    lineageHTML = `
      <div class="sidebar-section">
        <div class="sidebar-label">Lineage</div>
        <div class="sidebar-lineage">
          ← begat from <a onclick="window._openTicket(${predecessorId})">#${predecessorId}</a>
        </div>
      </div>
    `;
  }
  if (root.status === "superseded") {
    const successor = [...tickets.values()].find(
      (t) => t.metadata?.predecessor_id === String(root.id)
    );
    if (successor) {
      lineageHTML = `
        <div class="sidebar-section">
          <div class="sidebar-label">Lineage</div>
          <div class="sidebar-lineage">
            Superseded → <a onclick="window._openTicket(${successor.id})">#${successor.id}</a>
          </div>
        </div>
      `;
    }
  }

  // Sub-ticket dependencies.
  let depsHTML = "";
  if (kids.length > 0) {
    const depItems = kids
      .map(
        (c) => `
        <div class="sidebar-dep">
          <span class="material-symbols-outlined dep-icon">link</span>
          <span class="dep-label">#${c.id}: ${c.type.replace(/^ui_/, "")}</span>
          <span class="status-pill ${c.status}" style="font-size:0.65rem;padding:0.15rem 0.4rem">${rawStatusLabel(c.status)}</span>
        </div>
      `
      )
      .join("");
    depsHTML = `
      <div class="sidebar-section">
        <div class="sidebar-label">Sub-tickets</div>
        <div class="sidebar-deps">${depItems}</div>
      </div>
    `;
  }

  ticketsView.innerHTML = `
    <div class="ticket-detail">
      <div class="ticket-detail-header">
        <button class="back-btn" onclick="window._closeTicketDetail()">
          <span class="material-symbols-outlined icon">arrow_back</span>
          Tickets
        </button>
        <div class="ticket-detail-heading">
          <div class="ticket-detail-id">#${root.id} · ${root.type.replace(/^ui_/, "")}</div>
          <div class="ticket-detail-title">${escapeHTML(prompt)}</div>
        </div>
      </div>
      <div class="ticket-detail-body">
        <div class="ticket-main">
          <div class="activity-section-label">Activity Feed</div>
          <div class="activity-feed">
            ${activityItems.join("")}
          </div>
        </div>
        <div class="ticket-sidebar">
          <div class="sidebar-section">
            <div class="sidebar-label">Status & Priority</div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
              <span class="status-pill ${root.status}">${rawStatusLabel(root.status)}</span>
              <span class="priority-dot ${priority}">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
            </div>
          </div>
          <div class="sidebar-section">
            <div class="sidebar-label">Assignee</div>
            <div class="sidebar-assignee">
              ${assigneeIcon(assignee)}
              <span class="sidebar-value">${escapeHTML(assignee)}</span>
            </div>
          </div>
          <div class="sidebar-section">
            <div class="sidebar-row">
              <div class="sidebar-field">
                <div class="sidebar-label">Created</div>
                <div class="sidebar-value">${formatFullDate(root.created_at)}</div>
              </div>
              <div class="sidebar-field">
                <div class="sidebar-label">Timestamp</div>
                <div class="sidebar-value">${formatTime(root.created_at)}</div>
              </div>
            </div>
          </div>
          ${depsHTML}
          ${lineageHTML}
        </div>
      </div>
    </div>
  `;

  // Load build previews in the activity feed.
  for (const child of kids) {
    if (child.type === "ui_build" && child.status === "resolved") {
      const iframe = document.getElementById(`activity-preview-${child.id}`);
      if (iframe && !iframe.srcdoc) {
        renderBundleInIframe(child.id, iframe);
      }
    }
  }
}

window._openTicket = function (id) {
  activeDebugTicketId = id;
  render();
};

window._closeTicketDetail = function () {
  activeDebugTicketId = null;
  render();
};

window._toggleEvents = function (id, btn) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle("open");
    btn.classList.toggle("open");
  }
};

// ─── Main Render ────────────────────────────────────────────────────────────

function render() {
  renderTaskView();
  renderDebugView();
}
