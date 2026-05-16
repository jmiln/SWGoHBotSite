$(document).ready(() => {
    // User dropdown toggle
    const $dropdownToggle = $("#nav-user-dropdown");
    const $dropdownMenu = $("#nav-user-menu");

    $dropdownToggle.on("click", (e) => {
        e.stopPropagation();
        const isOpen = $dropdownMenu.hasClass("open");
        $dropdownMenu.toggleClass("open", !isOpen);
        $dropdownToggle.attr("aria-expanded", String(!isOpen));
    });

    $(document).on("click", () => {
        $dropdownMenu.removeClass("open");
        $dropdownToggle.attr("aria-expanded", "false");
    });

    // Navbar toggle (mobile)
    const $navbarLinks = $("#navbar-links");
    $("#navbar-toggle").on("click", function () {
        const isExpanded = $(this).attr("aria-expanded") === "true";
        $(this).attr("aria-expanded", String(!isExpanded));
        $navbarLinks.toggleClass("open", !isExpanded);
    });

    // Highlight the active nav link
    const currentPage = location.pathname;
    $("#navbar .nav-links").each(function () {
        const $this = $(this);
        if ($this.attr("href") === currentPage) {
            $this.addClass("active");
        }
    });

    $("form[data-event-name]").on("submit", function (e) {
        const name = $(this).data("eventName");
        if (!window.confirm(`Delete event "${name}"? This cannot be undone.`)) {
            e.preventDefault();
        }
    });
});
