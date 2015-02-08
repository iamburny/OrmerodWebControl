<?php

$options = array(
    CURLOPT_URL => "http://192.168.1.144/rr_status",
    CURLOPT_RETURNTRANSFER => true, // return web page
    CURLOPT_CONNECTTIMEOUT => 120, // timeout on connect
    CURLOPT_TIMEOUT => 120, // timeout on response
);

$ch = curl_init();
curl_setopt_array($ch, $options);
$content = curl_exec($ch);

$header = curl_getinfo($ch);

curl_close($ch);

var_dump($header);

echo "<p>";

$response = json_decode($content);

var_dump($response);