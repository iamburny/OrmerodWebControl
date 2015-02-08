jQuery.extend({
    askElle: function (req, code) {
        var result;
        var query = "";
        switch (req) {
            case 'upload_data':
                query = "?data=" + code;		// 'code' has already been URI encoded
                break;
            case 'gcode':
                query = "?gcode=" + encodeURIComponent(code);
                break;
            case 'fileinfo':
                if (code == null)
                    break;
            case 'upload_begin':
            case 'delete':
                query = "?name=" + encodeURIComponent(code);
                break;
            case 'upload_end':
                query = "?size=" + code;
                break;
        }
        var url = '//' + ormerodIP + '/rr_' + req + query;
        
        $.ajax(url, {async: false, dataType: "json", success: function (data) {
                result = data;
            }});
        return result;
    }
});