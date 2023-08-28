#!/bin/bash
# create database schema for testing
mysql <test_create_tables.sql
# the connection data to your Mariadb server (or Mysql Server), please change it accordingly to your configuration.
export DB_HOST="localhost"
export DB_NAME="testdocsig"
export DB_USER="testdocsig"
export DB_PWD="As827-1727-1619"
node docsig-server.js
#pkill -fe 'docsig-server'
#mysql <test_clean_database.sql




