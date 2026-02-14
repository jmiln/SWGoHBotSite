$(document).ready(() => {
    // Initialize - show default category (General) on page load
    const defaultCategory = getDefaultCategory();
    showCategory(defaultCategory);

    // Handle category clicks
    $(".category-item").on("click", function () {
        const categoryName = $(this).data("category");
        showCategory(categoryName);
    });
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

    // Hide current category with fade, then show selected category
    const $visible = $(".command-grid:visible");
    if ($visible.length > 0) {
        $visible.fadeOut(200, () => {
            $(`.command-grid[data-category="${categoryName}"]`).fadeIn(200);
        });
    } else {
        // No visible category to hide, just show the selected one
        $(`.command-grid[data-category="${categoryName}"]`).fadeIn(200);
    }
};
