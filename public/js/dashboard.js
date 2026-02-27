$(() => {
    var dayMS = 24 * 60 * 60 * 1000;
    var hrMS = 60 * 60 * 1000;
    var minMS = 60 * 1000;

    function getPayoutMs(offset, hrDiff) {
        var now = Date.now();
        var d = new Date();
        var utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        var then = dayMS - 1 + utcMidnight - offset * minMS - hrDiff * hrMS;
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
            if (sortKey === "char-payout" || sortKey === "fleet-payout") {
                var hrDiff = sortKey === "char-payout" ? 6 : 5;
                var aOff = $a.data("po-offset");
                var bOff = $b.data("po-offset");
                if (aOff === "" && bOff === "") return 0;
                if (aOff === "") return 1;
                if (bOff === "") return -1;
                return getPayoutMs(Number.parseInt(aOff, 10), hrDiff) - getPayoutMs(Number.parseInt(bOff, 10), hrDiff);
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
