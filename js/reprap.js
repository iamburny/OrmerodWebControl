/*! Reprap Ormerod Control v0.10 | by Matt Burnett <matt@burny.co.uk>. | open license
*/
var polling = false;
var printing = false;
var paused = false;
var ormerodIP = "192.168.1.144";
var chart;
var chartData = [[],[]];

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
    for (var i=0; i<50; i++) {
        chartData[0].push([i,20]);
        chartData[1].push([i,10]);
    }
    chart = $.plot("#tempchart", chartData, {
        series: {shadowSize: 0},
        yaxis: {min: -20,max: 250},
        xaxis: {show: false}
    });
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

$('div#bedTemperature button#setHeadTemp, div#bedTemperature a#bedTempLink').on('click', function() {
    var code;
    if(this.nodeName === 'BUTTON') {
        code = $('input#bedTempInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', "M140 S"+code);
});

$('div#headTemperature button#setHeadTemp, div#headTemperature a#headTempLink').on('click', function() {
    var head = 0;
    var code;
    if(this.nodeName === 'BUTTON') {
        code = $('input#headTempInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', "G10 P"+head+" S"+code+"\nT"+head);
});

$('div#sendG button#txtinput, div#sendG a#gLink').on('click', function() {
    var code;
    if(this.nodeName === 'BUTTON') {
        code = $('input#gInput').val();
    } else {
        code = $(this).text();
    }
    $.askElle('gcode', code);
});

$('table#moveHead button').on('click', function() {
    var btnVal = $(this).attr('value');
    if(btnVal) {
        $.askElle('gcode', btnVal);
    } else {
        var value = $(this).text();

        var feedRate = " F2000";
        if (value.indexOf("Z") >= 0) feedRate = " F200";

        var movePreCode = "M120\nG91\nG1";
        var movePostCode = "\nM121";
        $.askElle('gcode', movePreCode+value+feedRate+movePostCode);
    }
});

$('div#panicBtn button').on('click', function() {
    var btnVal = $(this).attr('value');
    switch(btnVal) {
        case "M112":
            //panic stop
            polling=false;
            
            break;
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
        case "M18":
            //motors off
            break;
    }
    $.askElle('gcode', btnVal);
});

$("a#gFileLink").on('click', function() {
    var filename = $(this).text();
    $.askElle('gcode', "M23 "+filename+"\nM24");    
});

function disableButtons(which) {
    switch (which) {
        case "head":
            $('table#moveHead button, table#temp button, table#extruder button, div#feed label').addClass('disabled');
            break;
        case "panic":
            $('div#panicBtn button').addClass('disabled');
            break;
    }
}

function enableButtons(which) {
    switch (which) {
        case "head":
            $('table#moveHead button, table#temp button, table#extruder button, div#feed label').removeClass('disabled');
            break;
        case "panic":
            $('div#panicBtn button').removeClass('disabled');
            break;
    }
}

function message(type, text){
    $('div#messageBox').removeClass('alert-success alert-info alert-warning alert-danger');
    $('div#messageBox').html("");
    if (type !== 'hide') {
        var closeBtn = '<a class="close" data-dismiss="alert" href="#" aria-hidden="true">&times;</a>';
        $('div#messageBox').addClass('alert-'+type).html(closeBtn+text);
    }
}

function updatePage() {
    var status = $.askElle("poll", "");
    if (!status || !polling) {
        $('button#connect').removeClass('btn-success').addClass('btn-danger');
        $('button#printing').removeClass('btn-warning').removeClass('btn-success').addClass('btn-danger').text("Disconnected");
        if (polling) {
            message('danger',"<strong>Warning!</strong> Ormerod webserver is probably broken, power cycle/reset your Duet Board :(");
            $('button#connect').text("Retrying");
        } else {
            message('info',"<strong>Disconnected</strong> Page not being updated");
            $('button#connect').text("Connect");
        }
        $('span[id$="Temp"], span[id$="pos"]').text("??");
        disableButtons("head");
        disableButtons("panic");
    } else {
        $('button#connect').removeClass('btn-danger').addClass('btn-success').text("Connected");; //Connected Hoorahhh!
        enableButtons('head');
        message('hide', '');
        if (status.poll[0] === "I") {
            printing = false;
            disableButtons("panic");
            $('button#printing').removeClass('btn-danger').removeClass('btn-success').addClass('btn-warning');
            if (!paused) $('button#printing').text("Ready :)");
        } else if (status.poll[0] === "P") {
            enableButtons('panic');
            printing = true;
            $('button#printing').removeClass('btn-danger').removeClass('btn-warning').addClass('btn-success').text("Active");
        } else {
            $('button#printing').removeClass('btn-warning').removeClass('btn-success').addClass('btn-danger').text("Error!");
        }
        $('span#bedTemp').text(status.poll[1]);
        $('span#headTemp').text(status.poll[2]);
        $('span#Xpos').text(status.poll[3]);
        $('span#Ypos').text(status.poll[4]);  
        $('span#Zpos').text(status.poll[5]);
        $('span#Epos').text(status.poll[6]);
        chartData[0].push(parseFloat(status.poll[1]));
        chartData[1].push(parseFloat(status.poll[2]));
        if (chartData[0].length > 50) chartData[0].shift();
        if (chartData[1].length > 50) chartData[1].shift();
        var res = [[],[]];
        for (var i = 0; i < chartData[0].length; ++i) {
            res[0].push([i, chartData[0][i]]);
            res[1].push([i, chartData[1][i]]);
        }
        chart.setData(res);
        chart.draw();
    }
}

function listGFiles() {
    $('div#gFileList').html("");
    var result = $.askElle("files", "");
    result.files.forEach(function(item){
        $('div#gFileList').append('<a href="#" class="list-group-item" id="gFileLink">'+item+'</a>');
    });
}

function poll()
{
    setTimeout(function() {
        if(polling){
            updatePage();
            poll();
        }
    }, 2000);
}