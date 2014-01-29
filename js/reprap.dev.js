/*! Reprap Ormerod Control v0.10 | by Matt Burnett <matt@burny.co.uk>. | open license
 */
var polling = false;
var pollDelay = 1000;
var printing = false;
var paused = false;
var ormerodIP;
var layerHeight = 0.24;
var layerCount;
var currentLayer;
var objHeight;
var printStartTime;
var maxUploadBuffer = 900;
var maxUploadCommands = 100;
var messageSeqId = 0;

//Temp and Layer Chart
var chart;
var chart2;
var maxDataPoints = 200;
var chartData = [[], []];
var maxLayerBars = 100;
var layerData = [];
var bedColour = "#454BFF"; //blue
var headColour = "#FC2D2D"; //red

var gFile = [];
var gFilename;
var buffer;
var timerStart;

jQuery.extend({
    askElle: function(reqType, code) {
        var result = null;
        if (reqType === 'gcode') {
            code = code.replace(/\n/g, '%0A').replace('+', '%2B').replace('-', '%2D').replace(/\s/g, '+');
            $.ajax('//' + ormerodIP + '/rr_gcode?gcode='+code, {async:false});
        } else {
            $.ajax('//' + ormerodIP + '/rr_'+reqType, {async:false, success:function(data){result = data;}});
            return result;
        }
    }
});

$(document).ready(function() {
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
});

$('#connect').on('click', function() {
    if (polling) {
        polling = false;
        updatePage();
    } else {
        polling = true;
        listGFiles();
        $.askElle("gcode", "M115");
        updatePage();        
        $.askElle("gcode", "M503");
        poll();
    }
});

//temp controls
$('div#bedTemperature button#setBedTemp, div#bedTemperature a#bedTempLink').on('click', function() {
    var code;
    if (this.nodeName === 'BUTTON') {
        code = $('input#bedTempInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', "M140 S" + code);
});
$('div#headTemperature button#setHeadTemp, div#headTemperature a#headTempLink').on('click', function() {
    var head = 0;
    var code;
    if (this.nodeName === 'BUTTON') {
        code = $('input#headTempInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', "G10 P" + head + " S" + code + "\nT" + head);
});
$('input#bedTempInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', "M140 S" + $(this).val());
    }
});
$('input#headTempInput').keydown(function(event) {
    var head = 0;
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', "G10 P" + head + " S" + $(this).val() + "\nT" + head);
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
$('div#sendG button#txtinput, div#sendG a#gLink').on('click', function() {
    var code;
    if (this.nodeName === 'BUTTON') {
        code = $('input#gInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', code); //send gcode
});
$('input#gInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', $(this).val());
    }
});

//move controls
$('table#moveHead button').on('click', function() {
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
            polling = false;
            paused = false;
            break;
        case "reset":
            //reset printing after pause
            printing = false;
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
    listGFiles();
});

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
    var ext = getFileExt(fName);
    var fname = getFileName(fName);
    if (ext !== "g" && ext !== "gco" && ext !== "gcode") {
        alert('Not a G Code file');
        return false;
    } else {
        if (fname > 8)
            fname = fname.substr(0, 8);
        gFile = data.split(/\r\n|\r|\n/g);
        switch (action) {
            case "upload":
                gFilename = fname + '.g';
                fileUpload();
                break;
            case "print":
                gFilename = fName;
                timer();
                message("info", "Web Printing " + gFilename + " started");
                webPrintLoop();

                break;
        }

    }
}

function webPrintLoop() {
    var wait = 100;
    if (buffer < 100) wait = 1000;
    if (gFile.length > 0) {
        setTimeout(function() {
            if (buffer > 100) {
                webPrintSend();
            }
            webPrintLoop();
        }, wait);
    }
    if (gFile.length === 0) {
        message("success", "Finished web printing " + gFilename + " in " + (timer() - timerStart).toHHMMSS());
    }
}

function webPrintSend() { //Web Printing
    var i=0;
    var line = "";
    var resp;
    if (gFile.length > 0 && buffer > 0) {
        while(i < maxUploadCommands && (line.length + gFile[0].length + 3) < maxUploadBuffer ) {
            line += gFile[0] + "%0A";
            gFile.shift();
            i++;
        }
        $.askElle('gcode', line);        
        resp = $.askElle('poll', '');
        buffer = resp.buff;
    }
}

function fileUpload() { //multi line upload 
    timer();
    var line, codeType;
    var commandsToUpload = 0;
    var sendLine = "";
    $.askElle('gcode', "M28 " + gFilename);
    while (gFile.length > 0) {
        line = gFile[0].split(';'); //remove comments only want Gcodes
        gFile.shift();
        codeType = line[0].substr(0, 1);
        if (codeType == "G" || codeType == "M" || codeType == "T") {
            line[0] = line[0].replace(/(^\s+|\s+$|\t)/g, '');      //trim end spaces
            if ((sendLine.length + line[0].length + 3) > maxUploadBuffer || commandsToUpload >= maxUploadCommands) {
                $.askElle('gcode', sendLine);                 //character limit or command limit hit send it now
                commandsToUpload = 1;
                sendLine = line[0];                             //start a new message
            } else {
                if (sendLine !== ""){ sendLine += "%0A"; }         //more space so append
                sendLine += line[0];
                commandsToUpload += 1;
            }
        }
    }
    if (sendLine != "") $.askElle('gcode', sendLine); // check all is done, send if not
    $.askElle('gcode', "M29");
    listGFiles();
    $('#tabs a:eq(2)').tab('show'); //show gfile tab
    message("info", "uploaded " + gFilename + "<br> in " + timer().toHHMMSS());
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
            $('table#moveHead button, table#temp button, table#extruder button, table#extruder label').addClass('disabled');
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
            $('table#moveHead button, table#temp button, table#extruder button, table#extruder label').removeClass('disabled');
            break;
        case "panic":
            $('div#panicBtn button').removeClass('disabled');
            break;
        case "gfilelist":
            $('div#gFileList button, div#gFileList2 button, div#gFileList3 button').removeClass('disabled');
            break;
    }
}

function message(type, text) {
    var d = new Date();
    var time = zeroPrefix(d.getHours()) + ":" + zeroPrefix(d.getMinutes()) + ":" + zeroPrefix(d.getSeconds());
    $('div#messages').prepend(time + " <span class='alert-" + type + "'>" + text + "</span><br />");
}

function parseM503(response) {
    $('div#config').text('');
    var config = response.split(/\n/g);
    config.forEach(function(item) {
        $('div#config').append("<span class='alert-info col-md-9'>" + item + "</span><br />");
    });
}

function parseResponse(res) {
    switch (true) {
        case res.indexOf('Debugging enabled') >= 0:
            message('info', '<strong>M111</strong><br />' + res.replace(/\n/g, "<br />"));    
            break;
        case res.indexOf('Firmware') >= 0:
            if ($('p#firmVer').text() === "") {
                $('p#firmVer').text(res);
            }
            message('info', '<strong>M115</strong><br />' + res.replace(/\n/g, "<br />"));
            break;
        case res.indexOf('M550') >= 0:
            message('info', '<strong>M503</strong><br />' + res.replace(/\n/g, "<br />")); 
            parseM503(res);
            break;
        default:
            message('info', res);
            break;
    }

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
        $('button#connect').removeClass('btn-danger').addClass('btn-success').text("Connected");
        //Connected Hoorahhh!
        if (messageSeqId < status.seq) {
            messageSeqId = status.seq;
            parseResponse(status.resp);
        }
        buffer = status.buff;

        if (status.poll[0] === "I" && !paused) {
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
        } else if (status.poll[0] === "P") {
            //printing
            printing = true;
            objHeight = $('input#objheight').val();
            $('button#printing').removeClass('btn-danger').removeClass('btn-warning').addClass('btn-success').text("Active");
            enableButtons('panic');
            disableButtons("head");
            disableButtons("gfilelist");
            currentLayer = whichLayer(status.poll[5]);
            if (isNumber(objHeight)) {
                layerCount = Math.ceil(objHeight / layerHeight);
                setProgress(Math.ceil((currentLayer / layerCount) * 100), currentLayer, layerCount);
            } else {
                setProgress(0, 0, 0);
            }
            layers(currentLayer);
        } else {
            //unknown state
            printing = paused = false;
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
    var n = Math.round(currZ / layerHeight);
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

function setProgress(percent, layer, layers) {
    var barText = percent + "% Complete, Layer " + layer + " of " + layers;
    switch (true) {
        case layer !== 0 && percent <= 40:
            $('span#offBar').text(barText).attr('title', barText);
            $('span#progressText').text('').attr('title', '');
            break;
        case layer !== 0:
            $('span#progressText').text(barText).attr('title', barText);
            $('span#offBar').text('').attr('title', '');
            break;
        default:
            $('span#offBar').text('0% complete, layer 0 of 0');
            $('span#progressText').text('').attr('title', '');
            break;
    }
    $('div#progress').css("width", percent + "%");
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
        }, pollDelay);
    }
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
}
