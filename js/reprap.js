/*! Reprap Ormerod Web Control | by Matt Burnett <matt@burny.co.uk>. | open license
 */
var ver = 0.60; //App version
var polling = false; 
var webPrinting = false;
var printing = false;
var paused = false;
var chart,chart2,settings,ormerodIP,layerCount,currentLayer,objHeight,printStartTime,gFileLength,gFilename,buffer,timerStart;
var maxUploadBuffer = 800;
var maxUploadCommands = 200;
var messageSeqId = 0;
var temps;

//Temp/Layer Chart settings
var maxDataPoints = 200;
var chartData = [[], []];
var maxLayerBars = 100;
var layerData = [];
var bedColour = "#454BFF"; //blue
var headColour = "#FC2D2D"; //red

var gFile = [];
var macroGs = ['setbed.g'];
var chevLeft = "<span class='glyphicon glyphicon-chevron-left'></span>";
var chevRight = "<span class='glyphicon glyphicon-chevron-right'></span>";

jQuery.extend({
    askElle: function(reqType, code) {
        var result;
        var query = "";
        if (reqType === 'gcode' && code != "") {
            code = code.replace(/\n/g, '%0A').replace('+', '%2B').replace('-', '%2D').replace(/\s/g, '+');
            query = "?gcode="+code;
        }
        var url = '//' + ormerodIP + '/rr_'+reqType+query;
        $.ajax(url, {async:false,dataType:"json",success:function(data){result = data;}});
        return result;
    }
});


$(document).ready(function() {
    $.cookie.json = true;
    getCookies();
    loadSettings();
    
    moveVals(['X','Y','Z']);

    ormerodIP = location.host;
    $('#hostLocation').text(ormerodIP);

    if ($.support.fileDrop) {
        fileDrop();
    } else {
        alert('Your browser does not support file drag-n-drop :(');
    }

    //fill chart with dummy data
    for (var i = 0; i < maxDataPoints; i++) {
        chartData[0].push([i, 20]);
        chartData[1].push([i, 10]);
    }

    //chart line colours
    $('#bedTxt').css("color", bedColour);
    $('#headTxt').css("color", headColour);

    chart = $.plot("#tempchart", chartData, {
        series: {shadowSize: 0},
        colors: [bedColour, headColour],
        yaxis: {min: -20, max: 250},
        xaxis: {show: false},
        grid: {
            borderWidth: 0
        }
    });

    chart2 = $.plot("#layerChart", [{
            data: layerData,
            bars: {show: true}
        }], {
        series: {shadowSize: 0},
        xaxis: {minTickSize: 1, tickDecimals: 0, panRange: [0, null], zoomRange: [20, 50]},
        yaxis: {minTickSize: 1, min: 0, tickDecimals: 0, panRange: false},
        grid: {borderWidth: 0},
        pan: {interactive: true}
    });

    message('success', 'Page Load Complete');
    $('button#connect, button#printing').removeClass('disabled');
    
    if (getHTMLver() < ver) {
        //pop message
        modalMessage("Update! v"+ver+" is Available", "The version of reprap.htm on you Duet SD card is "+getHTMLver()+", the latest version is "+ver+", to ensure compatibility and with the latest javascript code, new features, and correct functionality it is highly recommended that you upgrade. The newest reprap.htm can be found at <a href='https://github.com/iamburny/OrmerodWebControl'>https://github.com/iamburny/OrmerodWebControl</a>", true);
    }
    
});

$('#connect').on('click', function() {
    if (polling) {
        polling = false;
        updatePage();
    } else {
        polling = true;
        updatePage();        
        listGFiles();
        $.askElle("gcode", "M115"); //get firmware
        poll();
    }
});

//temp controls
$('div#bedTemperature button#setBedTemp').on('click', function() { 
    $.askElle('gcode', "M140 S" + $('input#bedTempInput').val());
});
$('div#bedTemperature').on('click', 'a#bedTempLink', function() {
    $('input#bedTempInput').val($(this).text());
    $.askElle('gcode', "M140 S" + $(this).text());
});
$('div#headTemperature button#setHeadTemp').on('click', function() {
        $.askElle('gcode', "G10 P0 S" + $('input#headTempInput').val() + "\nT0");
});
$('div#headTemperature').on('click', 'a#headTempLink', function() {
    $('input#headTempInput').val($(this).text());
    $.askElle('gcode', "G10 P0 S" + $(this).text() + "\nT0");
});
$('input#bedTempInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', "M140 S" + $(this).val());
    }
});
$('input#headTempInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', "G10 P0 S" + $(this).val() + "\nT0");
    }
});
$('div#bedTemperature ul').on('click', 'a#addBedTemp', function() {
    var tempVal = $('input#bedTempInput').val();
    if (tempVal != "") {
        temps.bed.unshift(parseInt(tempVal));
        setCookies();
        loadSettings();
    }else{
        modalMessage("Error Adding Bed Temp!", "You must enter a Temperature to add it to the dropdown list", close);
    }
});
$('div#headTemperature ul').on('click', 'a#addHeadTemp', function() {
    var tempVal = $('input#headTempInput').val();
    if (tempVal != "") {
        temps.head.unshift(parseInt(tempVal));
        setCookies();
        loadSettings();
    }else{
        modalMessage("Error Adding Head Temp!", "You must enter a Temperature to add it to the dropdown list", close);
    }
});

//feed controls
$('div#feed button#feed').on('click', function() {
    var amount = $(this).val();
    var dir = "";
    if ($('input[name="feeddir"]:checked').attr('id') == "reverse") {
        dir = "-";
    }
    var feedRate = " F" + $('input[name="speed"]:checked').val();
    var code = "M120\nM83\nG1 E" + dir + amount + feedRate + "\nM121";
    $.askElle('gcode', code);
});

//gcodes
$('div#sendG button#txtinput, div#sendG a').on('click', function() {    
    var code;
    if (this.nodeName === 'BUTTON') {
        code = $('input#gInput').val().toUpperCase();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', code); //send gcode
});
$('div#quicks').on('click', 'a', function() {
    var code;
    if (this.attributes.itemprop) {
        code = this.attributes.itemprop.value;
    } else {
        code = $(this).text();
    }
   $.askElle('gcode', code);
});
$('input#gInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', $(this).val().toUpperCase());
    }
});

//move controls
$('table#moveHead').on('click', 'button', function() {
    var btnVal = $(this).attr('value');
    if (btnVal) {
        $.askElle('gcode', btnVal);
    } else {
        var value = $(this).text();

        var feedRate = " F2000";
        if (value.indexOf("Z") >= 0)
            feedRate = " F200";

        var movePreCode = "M120\nG91\nG1 ";
        var movePostCode = "\nM121";
        $.askElle('gcode', movePreCode + value + feedRate + movePostCode);
    }
});

//panic buttons
$('div#panicBtn button').on('click', function() {
    var btnVal = $(this).attr('value');
    switch (btnVal) {
        case "M112":
            //panic stop
            window.stop();
            webPrinting = false;
            polling = false;
            paused = false;
            break;
        case "reset":
            //reset printing after pause
            webPrinting = false;
            printing = false;
            paused = false;
            btnVal = "";
            //switch off heaters
            $.askElle('gcode', "M140 S0"); //bed off
            $.askElle('gcode', "G10 P0 S0\nT0"); //head 0 off
            resetLayerData();
        case "M24":
            //resume
            paused = false;
            $('button#pause').removeClass('active').text('Pause').attr('value', 'M25');
            $('button#printing').text("Ready :)");
            $('button#reset').addClass('hidden');
            break;
        case "M25":
            //pause
            paused = true;
            $(this).addClass('active').text('Resume').attr('value', 'M24');
            $('button#printing').text("Paused");
            $('button#reset').removeClass('hidden');
            break;
    }
    $.askElle('gcode', btnVal);
});

//g files
$("div#gFileList, div#gFileList2, div#gFileList3, div#gFileList4").on('click', 'button#gFileLink', function() {
    var danger = this.className.indexOf("btn-danger");
    if (danger < 0) {
        var filename = $(this).text();
        $.askElle('gcode', "M23 " + filename + "\nM24");
        message('success', "G files [" + filename + "] sent to print");
        $('#tabs a:eq(1)').tab('show');
        resetLayerData();
    }
}).on('mouseover', 'span#fileDelete', function() {
    $(this).parent().addClass('btn-danger');
}).on('mouseout', 'span#fileDelete', function() {
    $(this).parent().removeClass('btn-danger');
}).on('click', 'span#fileDelete', function() {
    var filename = $(this).parent().text();
    $.askElle('gcode', "M30 " + filename);
    message('success', "G files [" + filename + "] Deleted from the SD card");
    listGFiles();
});
$("button#filereload").on('click', function() {
    $('span#ulTitle').text("File Upload Status");
    setProgress(0, "ul", 0,0);
    listGFiles();
});

//Settings/cookie buttons
$("div#settings button#saveSettings").on('click', function(){
    saveSettings();
});
$("div#settings button#delSettings").on('click', function(){
    delSettings();
});

$('a[data-toggle="tab"]').on('show.bs.tab', function(e) {
    if (e.target.hash == "#settings") {
        $.askElle("gcode", "M503"); //get config.g on setting view
    }
});

//Messages 
$("div#messages button#clearLog").on('click', function(){
    message('clear', '');
});

function getCookies() {
    //if none use defaults here, probably move them elsewhere at some point!
    settings = $.cookie('settings');
    temps = $.cookie('temps');
    if (!settings) {
        settings = { pollDelay : 1000, layerHeight : 0.24, halfz : 0, noOK : 0 };
    }
    if (!temps) {
        temps = {'bed' : [120,65,0], 'head' : [240,185,0]};
    }
}

function setCookies() {
    $.removeCookie('settings', { path: '/' });
    $.cookie('settings', settings, { expires: 30, path: '/' });
    $.removeCookie('temps', { path: '/' });
    $.cookie('temps', temps, { expires: 30, path: '/' });
}

function loadSettings() {
    $('div#settings input#pollDelay').val(settings.pollDelay.toString());
    $('div#settings input#layerHeight').val(settings.layerHeight.toString())
    settings.halfz==1?$('div#settings input#halfz').prop('checked', true):$('div#settings input#halfz').prop('checked', false);
    settings.noOK==1?$('div#messages input#noOK').prop('checked', true):$('div#messages input#noOK').prop('checked', false);
    
    $('div#bedTemperature ul').html('<li class="divider"></li><li><a href="#" id="addBedTemp">Add Temp</a></li>');
    $('div#headTemperature ul').html('<li class="divider"></li><li><a href="#" id="addHeadTemp">Add Temp</a></li>');
    temps.bed.forEach(function(item){
        $('div#bedTemperature ul').prepend('<li><a href="#" id="bedTempLink">'+item+'</a></li>');
    });
    temps.head.forEach(function(item){
        $('div#headTemperature ul').prepend('<li><a href="#" id="headTempLink">'+item+'</a></li>');
    });
}

function delSettings() {
    $.removeCookie('settings', { path: '/' });
    $.removeCookie('temps', { path: '/' });
    getCookies();
    loadSettings();
}

function saveSettings() {
    var zwas = settings.halfz;
    settings.pollDelay = parseInt($('div#settings input#pollDelay').val());
    settings.layerHeight = parseFloat($('div#settings input#layerHeight').val());
    $('div#settings input#halfz').is(':checked')?settings.halfz=1:settings.halfz=0;  
    $('div#settings input#noOK').is(':checked')?settings.noOK=1:settings.noOK=0;  
    if (zwas !== halfz) {
        $('div#Zminus, div#Zplus').text('');
        moveVals(['Z']);
    } 
    setCookies();
}

function moveVals(axis) {
    axis.forEach(function(value) {
        settings.halfz&&value=='Z'?i=50:i=100;
        var button = 0;
        for (i; i >= 0.05; i=i/10) {
            $('div#'+value+'minus').append('<button type="button" class="btn btn-default disabled">'+chevLeft+value+'-'+i.toString()+'</button>');
            $('div#'+value+'plus').prepend('<button type="button" class="btn btn-default disabled">'+value+'+'+i.toString()+chevRight+'</button>');
            button++;
        }
    });

}

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function fileDrop() {
    $('#uploadGfile').fileDrop({
        decodeBase64: true,
        removeDataUriScheme: true,
        onFileRead: function(fileCollection) {
            //Loop through each file that was dropped
            $.each(fileCollection, function(i) {
                handleFileDrop(this.data, this.name, "upload");
            });
        },
        overClass: 'btn-success'
    });

    $('#printGfile').fileDrop({
        decodeBase64: true,
        removeDataUriScheme: true,
        onFileRead: function(fileCollection) {
            //Loop through each file that was dropped
            $.each(fileCollection, function(i) {
                handleFileDrop(this.data, this.name, "print");
            });
        },
        overClass: 'btn-success'
    });
}

function handleFileDrop(data, fName, action) {
    var ext = getFileExt(fName).toLowerCase();
    var fname = getFileName(fName).toLowerCase();
    if (ext !== "g" && ext !== "gco" && ext !== "gcode") {
        alert('Not a G Code file');
        return false;
    } else {
        if (fname.length > 8) { fname = fname.substr(0, 8); }
        gFile = data.split(/\r\n|\r|\n/g);
        gFileLength = gFile.length;
        timer();
        switch (action) {
            case "upload":
                gFilename = fname + '.g';
                $.askElle('gcode', "M28 " + gFilename);
                message("info", "File Upload of " + gFilename + " started");
                $('span#ulTitle').text("Uploading " + gFilename);
                uploadLoop(action);
                break;
            case "print":
                gFilename = fName;
                message("info", "Web Printing " + gFilename + " started");
                webPrinting = true;
                $('#tabs a:eq(1)').tab('show'); //show print status after drop tab
                uploadLoop(action);
                break;
        }
    }
}

function uploadLoop(action) { //Web Printing/Uploading
    var wait = 5;
    var resp;
    switch (true) {
        case webPrinting == false && action !== 'upload':
            //Break Loop stop sending
            $.askElle('gcode', 'M112');
            break;
        case gFile.length === 0:
            //Finished with Dropped file, stop loop, end tasks
            var duration = (timer() - timerStart).toHHMMSS();
            switch (action) {
                case "print":
                    webPrinting = false;
                    resetLayerData();
                    message("success", "Finished web printing " + gFilename + " in " + duration);                
                    break;
                case "upload":
                    $.askElle('gcode', "M29");
                    listGFiles();
                    $('span#ulTitle').text(gFilename + " Upload Complete in "+ duration);
                    message("info", gFilename + " Upload Complete in "+ duration);                
                    break;
            }
            break;
        default:
            if (buffer == null || buffer < 100) {
                resp = $.askElle('poll', '');
                buffer = resp.buff;
            }
            if (buffer < 100) {
                wait = 20;
            }else if (paused === true) {
                wait = 2000;
            } else {
                webSend();
            }
            setTimeout(function() {
                uploadLoop(action);
            }, wait);
            break;
    }
}

function webSend() { //Web Printing/Uploading
    var i=0;
    var line = "";
    var resp;
	if (buffer > maxUploadBuffer) {
		buffer = maxUploadBuffer;
	}
    if (gFile.length > 0) {
        while(gFile.length > 0 && i < maxUploadCommands && (line.length + gFile[0].length + 3) < buffer ) {
            if (i != 0) {
                line += "%0A";
            }
            line += gFile[0];
            gFile.shift();
            i++;
        }
        resp = $.askElle('gcode', line); //send chunk of gcodes, and get buffer response
        buffer = resp.buff;
        if (!webPrinting) setProgress(Math.floor((1 - (gFile.length / gFileLength)) * 100), "ul", 0,0);
    }
}

function listGFiles() {
    var filesPerCol = 6;
    var count = 0;
    var list = "gFileList";
    $('div#gFileList, div#gFileList2, div#gFileList3, div#gFileList4').html("");
    var result = $.askElle("files", "");
    result.files.forEach(function(item) {
        count++;
        switch (true) {
            case (count > (filesPerCol * 3)):
                list = "gFileList4";
                break;
            case (count > (filesPerCol * 2)):
                list = "gFileList3";
                break;
            case (count > filesPerCol):
                list = "gFileList2";
                break;
        }
        if(jQuery.inArray(item, macroGs) >= 0) {
            if (!$('div#quicks a[itemprop="M28 '+item+'"]').text()) {
                $('div#quicks td:eq(0)').append("<a href='#' role='button' class='btn btn-default disabled' itemprop='M28 "+item+"' id='quickgfile'>"+item+"</a>");
            }
        }
        $('div#' + list).append('<button type="button" class="btn btn-default" id="gFileLink"><span class="pull-left">' + item + '</span><span id="fileDelete" class="glyphicon glyphicon-trash pull-right"></span></button>');
    });
}

function getFileExt(filename) {
    return filename.split('.').pop();
}

function getFileName(filename) {
    return filename.split('.').shift();
}

function disableButtons(which) {
    switch (which) {
        case "head":
            $('table#moveHead button, table#temp button, table#extruder button, table#extruder label, div#quicks a, button#uploadGfile, button#printGfile').addClass('disabled');
            break;
        case "panic":
            $('div#panicBtn button').addClass('disabled');
            $('button#reset').addClass('hidden');
            break;
        case "gfilelist":
            $('div#gFileList button, div#gFileList2 button, div#gFileList3 button').addClass('disabled');
            break;
    }
}

function enableButtons(which) {
    switch (which) {
        case "head":
            $('table#moveHead button, table#temp button, table#extruder button, table#extruder label, div#quicks a, button#uploadGfile, button#printGfile').removeClass('disabled');
            break;
        case "panic":
            $('div#panicBtn button').removeClass('disabled');
            break;
        case "gfilelist":
            $('div#gFileList button, div#gFileList2 button, div#gFileList3 button').removeClass('disabled');
            break;
    }
}

function modalMessage(title, text, close) {
    $('div#modal h4.modal-title').text(title);
    $('div#modal div.modal-body').html(text);
    close?$('div#modal button#modalClose').removeClass('hidden'):$('div#modal button#modalClose').addClass('hidden');
    $('div#modal').modal({show:true});
}

function message(type, text) {
    var d = new Date();
    var time = zeroPrefix(d.getHours()) + ":" + zeroPrefix(d.getMinutes()) + ":" + zeroPrefix(d.getSeconds());
    if (type == 'clear') {
        $('div#messageText').html(time + " <span class='alert-info'>Log Cleared</span><br />");
    } else {
        $('div#messageText').prepend(time + " <span class='alert-" + type + "'>" + text + "</span><br />");
    }
}

function parseResponse(res) {
    switch (true) {
        case res.indexOf('Debugging enabled') >= 0:
            message('info', '<strong>M111</strong><br />' + res.replace(/\n/g, "<br />"));    
            break;
        case res.indexOf('Firmware') >= 0:
            var strt = res.indexOf("SION:") +5 ;
            var end = res.indexOf(" ELEC");
            if ($('p#firmVer').text() === "") {
                $('p#firmVer').text(res.substr(strt, end - strt));
            }
            message('info', '<strong>M115</strong><br />' + res.replace(/\n/g, "<br />"));
            break;
        case res.indexOf('M550') >= 0:
            message('info', '<strong>M503</strong><br />' + res.replace(/\n/g, "<br />")); 
            $('div#config').html("<span class='col-md-9'><br/><strong>Config.g File Contents:</strong></span>");
            res.split(/\n/g).forEach(function(item) {
                $('div#config').append("<span class='alert-info col-md-9'>" + item + "</span><br />");
            });            
            break;
        case res == "ok":
            if ($('div#messages input#noOK').is(':checked')) {
                message('info', res);
            }
            break;
        default:
            message('info', res);
            break;
    }
}

function homedWarning(x,y,z) {
    if ((x+y+z) < 3) {
        $('span#warning').text('*some axes are not homed');
    } else {    
        $('span#warning').text('');
    }
    x===0?$('button#homeX').removeClass('btn-primary').addClass('btn-warning'):$('button#homeX').removeClass('btn-warning').addClass('btn-primary');
    y===0?$('button#homeY').removeClass('btn-primary').addClass('btn-warning'):$('button#homeY').removeClass('btn-warning').addClass('btn-primary');
    z===0?$('button#homeZ').removeClass('btn-primary').addClass('btn-warning'):$('button#homeZ').removeClass('btn-warning').addClass('btn-primary');
}

function updatePage() {
    var status = $.askElle("poll", "");
    if (!status || !polling) {
        $('button#connect').removeClass('btn-success').addClass('btn-danger');
        $('button#printing').removeClass('btn-warning').removeClass('btn-success').addClass('btn-danger').text("Disconnected");
        if (polling) {
            message('danger', "<strong>Warning!</strong> Ormerod webserver is probably broken, power cycle/reset your Duet Board :(");
            $('button#connect').text("Retrying");
        } else {
            message('info', "<strong>Disconnected</strong> Page not being updated");
            $('button#connect').text("Connect");
        }
        $('span[id$="Temp"], span[id$="pos"]').text("0");
        disableButtons("head");
        disableButtons("panic");
    } else {
        $('button#connect').removeClass('btn-danger').addClass('btn-success').text("Online");
        //Connected Hoorahhh!
        if (messageSeqId !== status.seq) {
            messageSeqId = status.seq;
            parseResponse(status.resp);
        }
        buffer = status.buff;

        homedWarning(status.hx,status.hy,status.hz);

        if (status.poll[0] === "P" || (webPrinting && !paused)) {
            //printing
            printing = true;
            objHeight = $('input#objheight').val();
            $('button#printing').removeClass('btn-danger').removeClass('btn-warning').addClass('btn-success').text("Active");
            enableButtons('panic');
            disableButtons("head");
            disableButtons("gfilelist");
            currentLayer = whichLayer(status.poll[5]);
            if (isNumber(objHeight)) {
                layerCount = Math.ceil(objHeight / settings.layerHeight);
                setProgress(Math.ceil((currentLayer / layerCount) * 100), 'print', currentLayer, layerCount);
            } else {
                setProgress(0, 'print', 0, 0);
            }
            layers(currentLayer);
        } else if (status.poll[0] === "I" && !paused ) {
            //inactive, not printing
            printing = false;
            $('button#printing').removeClass('btn-danger').removeClass('btn-success').addClass('btn-warning').text("Ready :)");
            disableButtons("panic");
            enableButtons('head');
            enableButtons("gfilelist");
        } else if (status.poll[0] === "I" && paused) {
            //paused
            printing = true;
            $('button#printing').removeClass('btn-danger').removeClass('btn-success').addClass('btn-warning').text("Paused");
            enableButtons('panic');
            enableButtons('head');
        } else {
            //unknown state
            webPrinting = printing = paused = false;
            $('button#printing').removeClass('btn-warning').removeClass('btn-success').addClass('btn-danger').text("Error!");
            message('danger', 'Unknown Poll State : ' + status.poll[0]);
        }

        $('span#bedTemp').text(status.poll[1]);
        $('span#headTemp').text(status.poll[2]);
        $('span#Xpos').text(status.poll[3]);
        $('span#Ypos').text(status.poll[4]);
        $('span#Zpos').text(status.poll[5]);
        $('span#Epos').text(status.poll[6]);
        $('span#probe').text(status.probe);

        //Temp chart stuff
        chartData[0].push(parseFloat(status.poll[1]));
        chartData[1].push(parseFloat(status.poll[2]));
        chart.setData(parseChartData());
        chart.draw();
    }
}

function whichLayer(currZ) {
    var n = Math.round(currZ / settings.layerHeight);
    if (n === currentLayer + 1 && currentLayer) {
        layerChange();
    }
    return n;
}

function resetLayerData() {
    //clear layercount
    layerData = [];
    printStartTime = null;
    $('span#elapsed, span#lastlayer').text("00:00:00");

}

function layerChange() {
    var d = new Date();
    var utime = d.getTime();
    layerData.push(utime);
    if (printStartTime && layerData.length > 1) {
        var lastLayerEnd = layerData[layerData.length - 2];
        $('span#lastlayer').text((utime - lastLayerEnd).toHHMMSS());
        chart2.setData(parseLayerData());
        chart2.setupGrid();
        chart2.draw();
    }
}

function layers(layer) {
    var d = new Date();
    var utime = d.getTime();
    if (layer === 1 && !printStartTime) {
        printStartTime = utime;
        layerData.push(utime);
    }
    if (printStartTime) {
        $('span#elapsed').text((utime - printStartTime).toHHMMSS());
    }
}

function zeroPrefix(num) {
    var n = num.toString();
    if (n.length === 1) {
        return "0" + n;
    }
    return n;
}

function setProgress(percent, bar, layer, layers) {
    var barText = $('span#'+bar+'ProgressText');
    var offText = $('span#'+bar+'OffBar');
    var ptext = percent + "% Complete";
    if(bar == 'print') {
        ptext += ", Layer " + layer + " of " + layers;
    }
    
    switch (true) {
        case percent <= 40 && percent > 0:
            barText.text('').attr('title', '');
            offText.text(ptext).attr('title', ptext);
            break;
        case percent > 40:
            barText.text(ptext).attr('title', ptext);
            offText.text('').attr('title', '');
            break;
        default:
            barText.text('').attr('title', '');
            offText.text('0% complete, layer 0 of 0');
            break;
    }
    $('div#'+bar+'Progress').css("width", percent + "%");
}

function parseLayerData() {
    if (layerData.length > maxLayerBars)
        layerData.shift();
    var res = [];
    //res.push([0,0]);
    var elapsed;
    for (var i = 1; i < layerData.length; ++i) {
        elapsed = Math.round((layerData[i] - layerData[i - 1]) / 1000);
        res.push([i, elapsed]);
    }
    return [res];
}

function parseChartData() {
    if (chartData[0].length > maxDataPoints)
        chartData[0].shift();
    if (chartData[1].length > maxDataPoints)
        chartData[1].shift();
    var res = [[], []];
    for (var i = 0; i < chartData[0].length; ++i) {
        res[0].push([i, chartData[0][i]]);
        res[1].push([i, chartData[1][i]]);
    }
    return res;
}

function timer() {
    var d = new Date();
    if (!timerStart) {
        timerStart = d.getTime();
    } else {
        var elapsed = d.getTime() - timerStart;
        timerStart = null;
        return elapsed;
    }
}

function poll() {
    if (polling) {
        setTimeout(function() {
            updatePage();
            poll();
        }, settings.pollDelay);
    }
}

function getHTMLver() {
    return document.title.substr(document.title.indexOf("v")+1);
}

Number.prototype.toHHMMSS = function() {
    var sec_num = Math.floor(this / 1000); // don't forget the second param
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    var time = hours + ':' + minutes + ':' + seconds;
    return time;
};
