$(() => {
    function sortTable($table, sortKey) {
        const $tbody = $table.find("tbody");
        const rows = $tbody.find("tr").toArray();

        rows.sort((a, b) => {
            const $a = $(a);
            const $b = $(b);

            if (sortKey === "name") {
                return $a.data("name").localeCompare($b.data("name"));
            }
            if (sortKey === "char") {
                const aChar = $a.data("char") !== "" ? Number.parseInt($a.data("char"), 10) : Number.POSITIVE_INFINITY;
                const bChar = $b.data("char") !== "" ? Number.parseInt($b.data("char"), 10) : Number.POSITIVE_INFINITY;
                return aChar - bChar;
            }
            if (sortKey === "ship") {
                const aShip = $a.data("ship") !== "" ? Number.parseInt($a.data("ship"), 10) : Number.POSITIVE_INFINITY;
                const bShip = $b.data("ship") !== "" ? Number.parseInt($b.data("ship"), 10) : Number.POSITIVE_INFINITY;
                return aShip - bShip;
            }
            // Sorting by Payout Timestamps
            if (sortKey === "char-payout" || sortKey === "fleet-payout") {
                const aTime = Number($a.data(sortKey)) || Number.POSITIVE_INFINITY;
                const bTime = Number($b.data(sortKey)) || Number.POSITIVE_INFINITY;

                // If the time is 0 (missing offset), push to bottom
                if (aTime === 0) return 1;
                if (bTime === 0) return -1;

                return aTime - bTime;
            }
            return 0;
        });

        $.each(rows, (_i, row) => {
            $tbody.append(row);
        });
    }

    const $arenaWatchTable = $("#arena-watch-table");
    if ($arenaWatchTable.length) {
        sortTable($arenaWatchTable, "name");
    }

    const $linkedAccountsTable = $("#linked-accounts-table");
    if ($linkedAccountsTable.length) {
        sortTable($linkedAccountsTable, "name");
    }

    $(".config-sort-btn").on("click", function () {
        const $btn = $(this);
        const $table = $btn.closest(".config-section").find(".config-table");
        const sortKey = $btn.data("sort");

        $btn.closest(".config-sort").find(".config-sort-btn").removeClass("active").attr("aria-pressed", "false");
        $btn.addClass("active").attr("aria-pressed", "true");

        sortTable($table, sortKey);
    });
});
