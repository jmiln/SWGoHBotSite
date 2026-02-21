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
    $("#navbar-toggle").on("click", function () {
        const navbar = document.getElementById("navbar");
        const menus = navbar.getElementsByClassName("nav-links");
        for (let ix = 0; ix < menus.length; ix++) {
            menus[ix].classList.toggle("hide-mobile");
        }
        const buttons = navbar.getElementsByClassName("nav-btn");
        for (let ix = 0; ix < buttons.length; ix++) {
            if (!buttons[ix].closest(".nav-right")) {
                buttons[ix].classList.toggle("hide-mobile");
            }
        }
        const isExpanded = $(this).attr("aria-expanded") === "true";
        $(this).attr("aria-expanded", String(!isExpanded));
    });

    // Highlight the active nav link
    const currentPage = location.pathname;
    $("#navbar .nav-links").each(function () {
        const $this = $(this);
        if ($this.attr("href") === currentPage) {
            $this.addClass("active");
        }
    });
});
