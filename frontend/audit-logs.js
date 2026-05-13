(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    logs: []
  };

  const els = {
    action: document.getElementById("auditAction"),
    entityType: document.getElementById("auditEntityType"),
    entityId: document.getElementById("auditEntityId"),
    limit: document.getElementById("auditLimit"),
    searchButton: document.getElementById("auditSearchButton"),
    message: document.getElementById("auditMessage"),
    tableWrap: document.getElementById("auditTableWrap"),
    resultSummary: document.getElementById("auditResultSummary")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({
      active: "audit",
      contextLabel: "Audit Logs"
    });
    if (!session) {
      window.location.href = "index.html";
      return;
    }

    state.session = session;
    bindEvents();
    await loadAuditLogs();
  }

  function bindEvents() {
    els.searchButton?.addEventListener("click", loadAuditLogs);
    [els.action, els.entityType, els.limit].forEach((input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") loadAuditLogs();
      });
    });
    els.entityId?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadAuditLogs();
    });
  }

  async function loadAuditLogs() {
    setLoading(true);
    APP.clearMessage?.(els.message);
    try {
      const params = new URLSearchParams();
      appendParam(params, "action", els.action?.value);
      appendParam(params, "entityType", els.entityType?.value);
      appendParam(params, "entityId", els.entityId?.value);
      appendParam(params, "limit", els.limit?.value || "200");

      const response = await APP.apiGet(`/audit-logs?${params.toString()}`, true);
      state.logs = normalizeArray(response, ["auditLogs", "logs", "data"], []);
      renderLogs();
      APP.showSuccess?.(els.message, `${state.logs.length} audit record${state.logs.length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      console.error("Audit log load error:", error);
      renderEmpty("Audit records could not be loaded.");
      APP.showError?.(els.message, error?.message || "Audit records could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }

  function appendParam(params, key, value) {
    const clean = String(value || "").trim();
    if (clean) params.set(key, clean);
  }

  function setLoading(isLoading) {
    if (!els.searchButton) return;
    els.searchButton.disabled = isLoading;
    els.searchButton.textContent = isLoading ? "Searching..." : "Search";
  }

  function renderLogs() {
    if (!state.logs.length) {
      renderEmpty("No audit records match the current filters.");
      return;
    }

    if (els.resultSummary) {
      els.resultSummary.textContent = `${state.logs.length} record${state.logs.length === 1 ? "" : "s"} shown.`;
    }

    els.tableWrap.innerHTML = `
      <table class="audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Record</th>
            <th>Summary</th>
            <th>Actor</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${state.logs.map(renderLogRow).join("")}
        </tbody>
      </table>
    `;
  }

  function renderLogRow(log) {
    const action = String(log.action || "activity").toLowerCase();
    const details = flattenDetails(log.data || log.details || {});
    return `
      <tr>
        <td>${escapeHtml(formatDateTime(log.createdAt))}</td>
        <td><span class="audit-action ${escapeHtml(action)}">${escapeHtml(formatLabel(action))}</span></td>
        <td>
          <strong>${escapeHtml(formatLabel(log.entityType || "record"))}</strong>
          ${log.entityId ? `<span class="audit-id">${escapeHtml(log.entityId)}</span>` : ""}
        </td>
        <td>${escapeHtml(log.summary || "Activity recorded")}</td>
        <td>${escapeHtml(log.actorEmail || log.actorId || "System")}</td>
        <td class="audit-details">${escapeHtml(details || "—")}</td>
      </tr>
    `;
  }

  function renderEmpty(message) {
    if (els.resultSummary) els.resultSummary.textContent = message;
    if (els.tableWrap) {
      els.tableWrap.innerHTML = `
        <div class="empty-state">
          <h3>No audit records displayed.</h3>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  function flattenDetails(data) {
    if (!data || typeof data !== "object") return "";
    return Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .slice(0, 8)
      .map(([key, value]) => `${formatLabel(key)}: ${formatDetailValue(value)}`)
      .join(" • ");
  }

  function formatDetailValue(value) {
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (value && typeof value === "object") return "details recorded";
    return String(value);
  }

  function normalizeArray(response, keys, fallback) {
    if (Array.isArray(response)) return response;
    for (const key of keys) {
      if (Array.isArray(response?.[key])) return response[key];
    }
    return fallback;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
