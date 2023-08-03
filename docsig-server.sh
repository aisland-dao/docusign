#!/bin/bash
cd /usr/src/docsig
# the connection data to your Mariadb server (or Mysql Server), please change it accordingly to your configuration.
export DB_HOST="localhost"
export DB_NAME="docsig"
export DB_USER="docsig"
export DB_PWD="your_password"
# you can create a user in mysql with:
# CREATE USER 'docsig'@'localhost' IDENTIFIED BY 'your_password';
# GRANT ALL PRIVILEGES ON docsig.* TO 'docsig'@'localhost';
# FLUSH PRIVILEGES;
# we assume the package is in the sam folder, eventually change the path
node docsig-server.js