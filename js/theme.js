$(function () {
    $('[data-open="hideMenu"]').click(function () {
        $('[data-open]').parent().removeClass('active');
        setTimeout(function () {
            $('.print3d-sidebar').toggleClass('aside-close');
            $('.aside-text, .aside-arrow, .search-aside, .power-aside, .theme-update-aside').toggle();
        }, 100);
    });
    return false;
});
