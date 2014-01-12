/*! Reprap Ormerod Control v0.10 | by Matt Burnett <matt@burny.co.uk>. | open license
 */
var polling = false;
var printing = false;
var paused = false;
var ormerodIP = "192.168.1.144";
var layerHeight = 0.24;
var layerCount;
var currentLayer;
var objHeight;

//Temp Chart
var chart;
var maxDataPoints = 100;
var chartData = [[], []];
var bedColour = "#454BFF";
var headColour = "#FC2D2D"

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

jQuery.extend({
    askElle: function(reqType, code) {
        var result = null;
        $.ajax({
            url: "http://" + ormerodIP + "/rr_" + reqType,
            dataType: 'json',
            data: {gcode: code},
            async: false,
            success: function(data) {
                result = data;
            }
        });
        return result;
    }
});

$(document).ready(function() {
    for (var i = 0; i < maxDataPoints; i++) {
        chartData[0].push([i, 20]);
        chartData[1].push([i, 10]);
    }

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
    //$('div#feed input#2').button('toggle');
    //$('div#feed input#forward').button('toggle');    
});

$('#connect').on('click', function() {
    if (polling) {
        polling = false;
        updatePage();
    } else {
        polling = true;
        updatePage();
        listGFiles();
        poll();
    }
});

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

$('div#feed button#feed').on('click', function() {
    var amount = $(this).val();
    var dir = "";
    if ($('input[name="feeddir"]:checked').attr('id') == "reverse") {
        dir = "-";
    }
    var feedRate = " F" + $('input[name="speed"]:checked').val();
    var code = "M120\nG83\nG1 E" + dir + amount + feedRate + "\nM121";
    $.askElle('gcode', code);
});

$('div#sendG button#txtinput, div#sendG a#gLink').on('click', function() {
    var code;
    if (this.nodeName === 'BUTTON') {
        code = $('input#gInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', code);
});

$('input#gInput').keydown(function(event) {
    if (event.which === 13) {
        event.preventDefault();
        $.askElle('gcode', $(this).val());
    }
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

$('table#moveHead button').on('click', function() {
    var btnVal = $(this).attr('value');
    if (btnVal) {
        $.askElle('gcode', btnVal);
    } else {
        var value = $(this).text();

        var feedRate = " F2000";
        if (value.indexOf("Z") >= 0)
            feedRate = " F200";

        var movePreCode = "M120\nG91\nG1";
        var movePostCode = "\nM121";
        $.askElle('gcode', movePreCode + value + feedRate + movePostCode);
    }
});

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
        case "M24":
            //resume
            paused = false;
            $(this).removeClass('active').text('Pause').attr('value', 'M25');
            $('button#printing').text("Ready :)");
            break;
        case "M25":
            //pause
            paused = true;
            $(this).addClass('active').text('Resume').attr('value', 'M24');
            $('button#printing').text("Paused");
            break;
    }
    $.askElle('gcode', btnVal);
});

$("div#gFileList, div#gFileList2, div#gFileList3").on('click', 'button#gFileLink', function() {
    var filename = $(this).text();
    $.askElle('gcode', "M23 " + filename + "\nM24");
});

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
    $('div#messageBox').removeClass('alert-success alert-info alert-warning alert-danger');
    $('div#messageBox').html("");
    if (type !== 'hide') {
        var closeBtn = '<a class="close" data-dismiss="alert" href="#" aria-hidden="true">&times;</a>';
        $('div#messageBox').addClass('alert-' + type).html(closeBtn + text);
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
        $('span[id$="Temp"], span[id$="pos"]').text("??");
        disableButtons("head");
        disableButtons("panic");
    } else {
        $('button#connect').removeClass('btn-danger').addClass('btn-success').text("Connected");
        ; //Connected Hoorahhh!
        message('hide', '');
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
            $('button#reset').removeClass('hidden');
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
            if (isNumber(objHeight)) {
                layerCount = objHeight / layerHeight;
                currentLayer = Math.ceil(status.poll[5] / layerHeight);
                setProgress((currentLayer / layerCount) * 100);
            } else {
               setProgress(0);
            }
        } else {
            //unknown state
            printing = paused = false;
            $('button#printing').removeClass('btn-warning').removeClass('btn-success').addClass('btn-danger').text("Error!");
        }
        $('span#bedTemp').text(status.poll[1]);
        $('span#headTemp').text(status.poll[2]);
        $('span#Xpos').text(status.poll[3]);
        $('span#Ypos').text(status.poll[4]);
        $('span#Zpos').text(status.poll[5]);
        $('span#Epos').text(status.poll[6]);

        //Temp chart stuff
        chartData[0].push(parseFloat(status.poll[1]));
        chartData[1].push(parseFloat(status.poll[2]));
        chart.setData(parseChartData());
        chart.draw();
    }
}

function setProgress(percent) {
    $('div#progress').css("width", percent + "%");
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

function listGFiles() {
    var count = 0;
    var list = "gFileList";
    $('div#gFileList').html("");
    var result = $.askElle("files", "");
    result.files.forEach(function(item) {
        count++;
        switch (true) {
            case (count > 14):
                list = "gFileList2";
                break;
            case (count > 29):
                list = "gFileList3";
                break;
        }
        $('div#' + list).append('<button type="button" class="btn btn-default" id="gFileLink">' + item + '</button>');
    });
}

function poll()
{
    setTimeout(function() {
        if (polling) {
            updatePage();
            poll();
        }
    }, 2000);
}