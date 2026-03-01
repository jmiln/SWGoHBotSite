const deleteForm = document.querySelector("form[data-event-name]");
if (deleteForm) {
    deleteForm.addEventListener("submit", (e) => {
        const name = deleteForm.dataset.eventName;
        if (!confirm(`Delete event "${name}"? This cannot be undone.`)) {
            e.preventDefault();
        }
    });
}

const textarea = document.getElementById("message");
const counter = document.getElementById("messageCount");
if (textarea && counter) {
    textarea.addEventListener("input", () => {
        counter.textContent = textarea.value.length;
    });
}

// Show detected timezone in the hint
const tzNameSpan = document.getElementById("tzName");
if (tzNameSpan) {
    tzNameSpan.textContent = ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}

// On edit forms, convert the server's UTC value to local time for display
const dtInput = document.getElementById("eventDT");
if (dtInput?.dataset.utc) {
    const utcDate = new Date(`${dtInput.dataset.utc}:00Z`);
    const pad = (n) => String(n).padStart(2, "0");
    dtInput.value = `${utcDate.getFullYear()}-${pad(utcDate.getMonth() + 1)}-${pad(utcDate.getDate())}T${pad(utcDate.getHours())}:${pad(utcDate.getMinutes())}`;
}

const channelSelect = document.getElementById("channel");
const channelError = document.getElementById("channelError");
if (channelSelect && channelError) {
    channelSelect.addEventListener("change", () => {
        channelError.style.display = "none";
    });
}

// Before submit, validate date is in the future and convert local time to UTC for server storage
document.getElementById("event-edit-form")?.addEventListener("submit", (e) => {
    if (channelSelect?.dataset.required === "true" && !channelSelect.value) {
        e.preventDefault();
        if (channelError) channelError.style.display = "";
        channelSelect.focus();
        return;
    }

    const errEl = document.getElementById("dtPastError");
    if (dtInput?.value) {
        if (new Date(dtInput.value) <= new Date()) {
            e.preventDefault();
            if (errEl) errEl.style.display = "";
            dtInput.focus();
            return;
        }
        if (errEl) errEl.style.display = "none";
        dtInput.value = new Date(dtInput.value).toISOString().slice(0, 16);
    }
});

dtInput?.addEventListener("input", () => {
    document.getElementById("dtPastError")?.style.setProperty("display", "none");
});

const intervalInputs = ["repeatDay", "repeatHour", "repeatMin"].map((id) => document.getElementById(id)).filter(Boolean);
const repeatDaysInput = document.getElementById("repeatDays");

function syncRepeatExclusion() {
    const hasInterval = intervalInputs.some((el) => el.value && Number.parseInt(el.value, 10) > 0);
    const hasDays = repeatDaysInput.value.trim().length > 0;

    repeatDaysInput.disabled = hasInterval;
    intervalInputs.forEach((el) => {
        el.disabled = hasDays;
    });

    document.getElementById("repeatIntervalGroup")?.classList.toggle("form-group--locked", hasDays);
    document.getElementById("repeatDaysGroup")?.classList.toggle("form-group--locked", hasInterval);

    const note = document.getElementById("repeatExclusionNote");
    if (note) note.style.display = hasInterval || hasDays ? "" : "none";
}

if (intervalInputs.length && repeatDaysInput) {
    intervalInputs.forEach((el) => {
        el.addEventListener("input", syncRepeatExclusion);
    });
    repeatDaysInput.addEventListener("input", syncRepeatExclusion);
    syncRepeatExclusion();
}
