#!/bin/bash
cd /usr/src/docusign
# the connection data to your Mariadb server (or Mysql Server), please change it accordingly to your configuration.
export DB_HOST="localhost"
export DB_NAME="docusign"
export DB_USER="docusign"
export DB_PWD="your_password"
# you can create a user in mysql with:
# CREATE USER 'docusign'@'localhost' IDENTIFIED BY 'your_password';
# GRANT ALL PRIVILEGES ON docusign.* TO 'docusign'@'localhost';
# FLUSH PRIVILEGES;
# we assume the package is in the sam folder, eventually change the path
node docusign-server.js