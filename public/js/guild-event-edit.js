// --- DOM refs ---
const deleteForm = document.querySelector("form[data-event-name]");
const textarea = document.getElementById("message");
const counter = document.getElementById("messageCount");
const tzNameSpan = document.getElementById("tzName");
const dtInput = document.getElementById("eventDT");
const dtPastError = document.getElementById("dtPastError");
const channelSelect = document.getElementById("channel");
const channelError = document.getElementById("channelError");
const repeatDaysInput = document.getElementById("repeatDays");
const repeatDaysError = document.getElementById("repeatDaysError");
const intervalInputs = ["repeatDay", "repeatHour", "repeatMin"].map((id) => document.getElementById(id)).filter(Boolean);

// --- Delete confirmation ---
if (deleteForm) {
    deleteForm.addEventListener("submit", (e) => {
        const name = deleteForm.dataset.eventName;
        if (!confirm(`Delete event "${name}"? This cannot be undone.`)) {
            e.preventDefault();
        }
    });
}

// --- Message character counter ---
if (textarea && counter) {
    textarea.addEventListener("input", () => {
        counter.textContent = textarea.value.length;
    });
}

// --- Timezone display ---
if (tzNameSpan) {
    tzNameSpan.textContent = ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}

// --- Convert UTC datetime to local time for display ---
if (dtInput?.dataset.utc) {
    const utcDate = new Date(`${dtInput.dataset.utc}:00Z`);
    const pad = (n) => String(n).padStart(2, "0");
    dtInput.value = `${utcDate.getFullYear()}-${pad(utcDate.getMonth() + 1)}-${pad(utcDate.getDate())}T${pad(utcDate.getHours())}:${pad(utcDate.getMinutes())}`;
}

// --- Clear errors on input ---
channelSelect?.addEventListener("change", () => {
    if (channelError) channelError.style.display = "none";
});
dtInput?.addEventListener("input", () => {
    if (dtPastError) dtPastError.style.display = "none";
});

// --- Repeat mutual exclusion ---
function syncRepeatExclusion() {
    const hasInterval = intervalInputs.some((el) => el.value && Number.parseInt(el.value, 10) > 0);
    const hasDays = repeatDaysInput.value.trim().length > 0;

    repeatDaysInput.disabled = hasInterval;
    for (const el of intervalInputs) {
        el.disabled = hasDays;
    }

    document.getElementById("repeatIntervalGroup")?.classList.toggle("form-group--locked", hasDays);
    document.getElementById("repeatDaysGroup")?.classList.toggle("form-group--locked", hasInterval);

    const note = document.getElementById("repeatExclusionNote");
    if (note) note.style.display = hasInterval || hasDays ? "" : "none";
}

if (intervalInputs.length && repeatDaysInput) {
    for (const el of intervalInputs) {
        el.addEventListener("input", syncRepeatExclusion);
    }
    repeatDaysInput.addEventListener("input", () => {
        if (repeatDaysError) repeatDaysError.style.display = "none";
        syncRepeatExclusion();
    });
    syncRepeatExclusion();
}

// --- Form submit validation ---
document.getElementById("event-edit-form")?.addEventListener("submit", (e) => {
    // Channel required (when no server-wide announce channel is configured)
    if (channelSelect?.dataset.required === "true" && !channelSelect.value) {
        e.preventDefault();
        if (channelError) channelError.style.display = "";
        channelSelect.focus();
        return;
    }

    // Date must be in the future
    if (dtInput?.value) {
        if (new Date(dtInput.value) <= new Date()) {
            e.preventDefault();
            if (dtPastError) dtPastError.style.display = "";
            dtInput.focus();
            return;
        }
        // Convert local datetime to UTC ISO string for server
        dtInput.value = new Date(dtInput.value).toISOString().slice(0, 16);
    }

    // repeatDays: each comma-separated value must be a positive integer > 0
    if (repeatDaysInput?.value.trim()) {
        const parts = repeatDaysInput.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const valid = parts.every((s) => /^\d+$/.test(s) && Number(s) > 0);
        if (!valid) {
            e.preventDefault();
            if (repeatDaysError) repeatDaysError.style.display = "";
            repeatDaysInput.focus();
            return;
        }
    }
});
