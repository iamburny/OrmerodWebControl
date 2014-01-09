OrmerodWebControl
=================

Web Control Interface for the RepRapPro Ormerod

reprap.htm - must reside on the Ormerod's Duet SD card this is the only file served by the on board web interface. 

favicon.ico
js (dir)
img(dir)
fonts(dir)
css(dir)

All of the above should be stored on a web server local to you, if you dont have a web server setup try :-

 xampp - http://www.apachefriends.org/en/xampp-windows.html

they provide a portable version that runs standalone from a directory, however pretty much any webserver (apart from the Duet one!) will do.

1. before copying reprap.htm to the SD card edit it and change all <link> href locations (top of file) and <script> src locations (end of file) to point to where they reside on your local webserver, you can "find and replace" anything beginning with "http://192.168.1.2/reprap".

2. edit js/reprap.js and change the value of "var ormerodIP" to be the IP of you Ormerod duet LAN interface (as configured in sys/config.g on your SD card).

Dont forget this is an early Alpha release, some features are missing, some may not work, I recommend you keep a close eye on your Ormerod while operating it via this interface as it has not been fully tested yet.

Any feed back is appreciated here http://forums.reprap.org/read.php?340,290811

thanks

iamburny (aka. Matt)