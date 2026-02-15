$(document).ready(() => {
    // Initialize - show default category (General) on page load
    const defaultCategory = getDefaultCategory();
    showCategory(defaultCategory);

    // Handle category clicks
    $(".category-item").on("click", function () {
        const categoryName = $(this).data("category");
        showCategory(categoryName);
    });

    // Handle filter changes
    $("#filter-dm, #filter-admin").on("change", applyFilters);

    // Handle reset button
    $("#reset-filters").on("click", resetFilters);
});

/**
 * Get the default category to show on page load
 * Prefers "General", falls back to first available category
 */
const getDefaultCategory = () => {
    const generalExists = $(".command-grid[data-category='General']").length > 0;
    if (generalExists) {
        return "General";
    }

    // If "General" doesn't exist, use the first available category (or "General" as ultimate fallback)
    const firstCategory = $(".command-grid").first().data("category");
    return firstCategory || "General";
};

/**
 * Show a specific category and hide all others
 * @param {string} categoryName - The category to display
 */
const showCategory = (categoryName) => {
    // Update sidebar active state
    $(".category-item").removeClass("active");
    $(`.category-item[data-category="${categoryName}"]`).addClass("active");

    // Hide all categories and show the selected one using the active class
    $(".command-grid").removeClass("active");
    $(`.command-grid[data-category="${categoryName}"]`).addClass("active");

    updateEmptyStates();
};

/**
 * Apply active filters to all command rows
 * Shows/hides commands based on DM availability and permission level
 */
const applyFilters = () => {
    const dmOnly = $("#filter-dm").is(":checked");
    const adminOnly = $("#filter-admin").is(":checked");

    $(".command-row").each(function () {
        const $row = $(this);
        const contexts = $row.data("contexts").toString().split(",");
        const permLevel = Number.parseInt($row.data("permlevel"), 10);

        let shouldShow = true;

        // DM filter: show only if contexts includes "1"
        if (dmOnly && !contexts.includes("1")) {
            shouldShow = false;
        }

        // Admin filter: show only if permLevel >= 3
        if (adminOnly && permLevel < 3) {
            shouldShow = false;
        }

        $row.toggle(shouldShow);
    });

    updateCategoryCounts();
    updateEmptyStates();
    toggleResetButton();
};

/**
 * Update category badge counts based on visible commands
 */
const updateCategoryCounts = () => {
    $(".category-item").each(function () {
        const $categoryItem = $(this);
        const categoryName = $categoryItem.data("category");

        // Count commands that are not hidden by filters (not display:none from toggle)
        const visibleCount = $(`.command-grid[data-category="${categoryName}"] .command-row`).filter(function () {
            // Check if this specific element has display:none set directly on it
            return this.style.display !== "none";
        }).length;

        // Update badge
        $categoryItem.find(".badge").text(visibleCount);
    });
};

/**
 * Show/hide empty state message for categories with no visible commands
 */
const updateEmptyStates = () => {
    $(".command-grid").each(function () {
        const $grid = $(this);
        const visibleCount = $grid.find(".command-row:visible").length;

        // Remove existing empty state
        $grid.find(".empty-state").remove();

        // Add empty state if no visible commands and grid is currently active
        if (visibleCount === 0 && $grid.hasClass("active")) {
            $grid.find(".grid-body").append('<div class="empty-state">No commands in this category match your current filters.</div>');
        }
    });
};

/**
 * Show/hide reset button based on active filters
 */
const toggleResetButton = () => {
    const anyFilterActive = $("#filter-dm").is(":checked") || $("#filter-admin").is(":checked");
    $("#reset-filters").toggle(anyFilterActive);
};

/**
 * Reset all filters to default state
 */
const resetFilters = () => {
    $("#filter-dm, #filter-admin").prop("checked", false);
    applyFilters();
};
