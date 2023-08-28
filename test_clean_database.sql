DROP DATABASE IF EXISTS `testdocsig`;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'testdocsig'@'localhost';
DROP USER IF EXISTS 'testdocsig'@'localhost';