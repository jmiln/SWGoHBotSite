function toggleNav() {
    // Toggle the nav in mobile mode
    const menus = document.getElementById("navbar").getElementsByClassName("nav-links");
    for (var ix = 0; ix < menus.length; ix++) {
        menus[ix].classList.toggle("hide-mobile");
    }
    const buttons = document.getElementById("navbar").getElementsByClassName("nav-btn");
    for (var ix = 0; ix < buttons.length; ix++) {
        buttons[ix].classList.toggle("hide-mobile");
    }
}

$(document).ready(function() {
	var currentPage = location.pathname;
	$('#navbar .nav-links').each(function(){
		var $this = $(this);
		// if the current path is like this link, make it active
		if($this.attr('href') === currentPage){
			$this.addClass('active');
		}
	})
})
