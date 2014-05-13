<?php

//router class

switch ($_SERVER['REQUEST_URI']) {
    case '/rr_files':
        $response = array("files" => array(
            "duettest.g",
            "setbed.g",
            "box-0.2.gcode",
            "circle.g",
            "square.g",
            "coathook.g",
            "Eiffel_Tower_mini-0.2.gcode",
            "box2-0.2.gcode",
            "Track_Bowl_1-0.2.gcode",
            "rotatingRings (repaired)-0.2.gcode",
            "setbed1.g"));
        break;
    case '/rr_status':
        $response = array(
            'buff' => 900,
            'extr' => array('6212.856'),
            'heaters' => array('60', '201.4'),
            'homed' => array(1, 1, 1),
            'pos' => array(100, 100, 5, 0.22),
            'probe' => '51',
            'resp' => 'ok',
            'seq' => 10461,
            'status' => 'I'
        );
        break;
    case '/rr_gcode':
        $response = array(
            'buff' => 900,
            'extr' => array('6212.856'),
            'heaters' => array('60', '201.4'),
            'homed' => array(1, 1, 1),
            'pos' => array(100, 100, 5, 0.22),
            'probe' => '51',
            'resp' => 'ok',
            'seq' => 10461,
            'status' => 'I'
        );
        break;
    case '/phpinfo':
        phpinfo();
        break;
    default:
        header("Location: /reprap.htm");
        break;
}

echo json_encode($response);

