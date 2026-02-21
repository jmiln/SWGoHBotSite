$(() => {
    function getCharPayoutMs(offset) {
        var now = Date.now();
        var dayMS = 24 * 60 * 60 * 1000;
        var hrMS = 60 * 60 * 1000;
        var minMS = 60 * 1000;
        var d = new Date();
        var utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        var then = dayMS - 1 + utcMidnight - offset * minMS - 6 * hrMS;
        if (then < now) then += dayMS;
        return then - now;
    }

    function sortTable($table, sortKey) {
        var $tbody = $table.find("tbody");
        var rows = $tbody.find("tr").toArray();

        rows.sort((a, b) => {
            var $a = $(a);
            var $b = $(b);

            if (sortKey === "name") {
                return $a.data("name").localeCompare($b.data("name"));
            }
            if (sortKey === "char") {
                var aChar = $a.data("char") !== "" ? Number.parseInt($a.data("char"), 10) : Number.POSITIVE_INFINITY;
                var bChar = $b.data("char") !== "" ? Number.parseInt($b.data("char"), 10) : Number.POSITIVE_INFINITY;
                return aChar - bChar;
            }
            if (sortKey === "ship") {
                var aShip = $a.data("ship") !== "" ? Number.parseInt($a.data("ship"), 10) : Number.POSITIVE_INFINITY;
                var bShip = $b.data("ship") !== "" ? Number.parseInt($b.data("ship"), 10) : Number.POSITIVE_INFINITY;
                return aShip - bShip;
            }
            if (sortKey === "payout") {
                var aOff = $a.data("po-offset");
                var bOff = $b.data("po-offset");
                if (aOff === "" && bOff === "") return 0;
                if (aOff === "") return 1;
                if (bOff === "") return -1;
                return getCharPayoutMs(Number.parseInt(aOff, 10)) - getCharPayoutMs(Number.parseInt(bOff, 10));
            }
            return 0;
        });

        $.each(rows, (_i, row) => {
            $tbody.append(row);
        });
    }

    var $arenaWatchTable = $("#arena-watch-table");
    if ($arenaWatchTable.length) {
        sortTable($arenaWatchTable, "name");
    }

    var $linkedAccountsTable = $("#linked-accounts-table");
    if ($linkedAccountsTable.length) {
        sortTable($linkedAccountsTable, "name");
    }

    $(".config-sort-btn").on("click", function () {
        var $btn = $(this);
        var $table = $btn.closest(".config-section").find(".config-table");
        var sortKey = $btn.data("sort");

        $btn.closest(".config-sort").find(".config-sort-btn").removeClass("active").attr("aria-pressed", "false");
        $btn.addClass("active").attr("aria-pressed", "true");

        sortTable($table, sortKey);
    });
});
