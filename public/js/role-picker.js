(function () {
    const chipsContainer = document.getElementById("adminRoleChips");
    const searchInput = document.getElementById("adminRoleSearch");
    const list = document.getElementById("adminRoleList");

    if (!chipsContainer || !searchInput || !list) return;

    const placeholder = chipsContainer.querySelector(".role-chips-placeholder");

    function updatePlaceholder() {
        const hasChips = chipsContainer.querySelectorAll(".role-chip").length > 0;
        placeholder.style.display = hasChips ? "none" : "";
    }

    function addChip(id, name) {
        if (chipsContainer.querySelector(`[data-chip-id="${CSS.escape(id)}"]`)) return;

        const chip = document.createElement("span");
        chip.className = "role-chip";
        chip.dataset.chipId = id;

        const label = document.createElement("span");
        label.textContent = name;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "role-chip-remove";
        btn.setAttribute("aria-label", `Remove ${name}`);
        btn.textContent = "\u00d7";
        btn.addEventListener("click", function () {
            const cb = list.querySelector(`input[type="checkbox"][value="${CSS.escape(id)}"]`);
            if (cb) {
                cb.checked = false;
                cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        chip.appendChild(label);
        chip.appendChild(btn);
        chipsContainer.appendChild(chip);
        updatePlaceholder();
    }

    function removeChip(id) {
        const chip = chipsContainer.querySelector(`[data-chip-id="${CSS.escape(id)}"]`);
        if (chip) chip.remove();
        updatePlaceholder();
    }

    // Render chips for pre-checked boxes on load
    list.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
        addChip(cb.value, cb.dataset.roleName);
    });
    updatePlaceholder();

    // Sync chips when a checkbox changes
    list.addEventListener("change", function (e) {
        if (e.target.type !== "checkbox") return;
        if (e.target.checked) {
            addChip(e.target.value, e.target.dataset.roleName);
        } else {
            removeChip(e.target.value);
        }
    });

    // Filter list on search input
    searchInput.addEventListener("input", function () {
        const query = searchInput.value.toLowerCase();
        let visibleCount = 0;

        list.querySelectorAll("li:not(.role-picker-empty)").forEach(function (li) {
            const name = li.querySelector("label").textContent.trim().toLowerCase();
            const matches = name.includes(query);
            li.style.display = matches ? "" : "none";
            if (matches) visibleCount++;
        });

        let emptyMsg = list.querySelector(".role-picker-empty");
        if (visibleCount === 0) {
            if (!emptyMsg) {
                emptyMsg = document.createElement("li");
                emptyMsg.className = "role-picker-empty";
                emptyMsg.textContent = "No roles match your search.";
                list.appendChild(emptyMsg);
            }
        } else if (emptyMsg) {
            emptyMsg.remove();
        }
    });
})();
