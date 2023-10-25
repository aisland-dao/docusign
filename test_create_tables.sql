-- MariaDB dump 10.19-11.0.2-MariaDB, for osx10.18 (arm64)
--
-- Host: localhost    Database: test
-- ------------------------------------------------------
-- Server version	11.0.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `documents`
--
DROP DATABASE IF EXISTS `testdocsig`;
CREATE DATABASE testdocsig;
use testdocsig;
DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) NOT NULL,
  `description` varchar(128) DEFAULT '',
  `originalfilename` varchar(128) DEFAULT NULL,
  `urlfile` varchar(128) DEFAULT '',
  `size` int(11) DEFAULT NULL,
  `mimetype` varchar(32) DEFAULT '',
  `hash` varchar(128) DEFAULT '',
  `status` varchar(16) DEFAULT 'draft',
  `dtlastupdate` datetime NOT NULL,
  `signaturetoken` varchar(128) DEFAULT '',
  `counterpart` varchar(64) DEFAULT '',
  `othercounterparts` text DEFAULT NULL,
  `publicviewtoken` varchar(128) DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `documentsaccount` (`account`),
  KEY `signersaccounts` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES
(95,'5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B','draft 5','Draft.dcs','026af8f3fb5f70e10361b31506833b30',308,'text/json','320a40c9bc6487eb86a8c463b8bbbb0b200d0250ec9741545b52c5130395ba49','waiting','2023-08-28 06:36:52','123f31793c7879b717813e1670e038171ce5fbaa1eb0fe7cee1e29d75a7cef3b','5C4qhY5c8eiNfzuFHfFrohERpTNBM286KiWB3YTwx6X9aDho',NULL,''),
(96,'5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B','Draft 1.dcs','Draft 1.dcs','59af0e234e8b79f13100d360131a563d',149,'text/json','0e16f6a1eb0e5249c87571969c78feb3d0db1ecac1cdb3add0d669270bf07d2a','draft','2023-08-28 06:40:47','','',NULL,'');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scannedsignatures`
--

DROP TABLE IF EXISTS `scannedsignatures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scannedsignatures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) NOT NULL,
  `type` varchar(1) DEFAULT 'S',
  `originalfilename` varchar(128) DEFAULT NULL,
  `urlfile` varchar(128) DEFAULT '',
  `size` int(11) DEFAULT NULL,
  `mimetype` varchar(32) DEFAULT '',
  `hash` varchar(128) DEFAULT '',
  `dtlastupdate` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `documentsaccount` (`account`),
  KEY `signersaccounts` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scannedsignatures`
--

LOCK TABLES `scannedsignatures` WRITE;
/*!40000 ALTER TABLE `scannedsignatures` DISABLE KEYS */;
/*!40000 ALTER TABLE `scannedsignatures` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `signers`
--

DROP TABLE IF EXISTS `signers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `signers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `documentid` int(11) NOT NULL,
  `account` varchar(64) NOT NULL,
  `email` varchar(128) DEFAULT '',
  `dtlastupdate` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `signersdocuments` (`documentid`),
  KEY `signersaccounts` (`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signers`
--

LOCK TABLES `signers` WRITE;
/*!40000 ALTER TABLE `signers` DISABLE KEYS */;
/*!40000 ALTER TABLE `signers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `standardsignatures`
--

DROP TABLE IF EXISTS `standardsignatures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `standardsignatures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) NOT NULL,
  `type` varchar(1) DEFAULT 'S',
  `originalfilename` varchar(128) DEFAULT NULL,
  `urlfile` varchar(128) DEFAULT '',
  `size` int(11) DEFAULT NULL,
  `mimetype` varchar(32) DEFAULT '',
  `hash` varchar(128) DEFAULT '',
  `dtlastupdate` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `documentsaccount` (`account`),
  KEY `signersaccounts` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `standardsignatures`
--

LOCK TABLES `standardsignatures` WRITE;
/*!40000 ALTER TABLE `standardsignatures` DISABLE KEYS */;
/*!40000 ALTER TABLE `standardsignatures` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `templates`
--

DROP TABLE IF EXISTS `templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tags` varchar(256) DEFAULT '',
  `description` varchar(64) DEFAULT '',
  `content` text DEFAULT NULL,
  `creator` varchar(64) DEFAULT NULL,
  `dtlastupdate` datetime NOT NULL,
  `private` varchar(1) DEFAULT 'Y',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `templates`
--

LOCK TABLES `templates` WRITE;
/*!40000 ALTER TABLE `templates` DISABLE KEYS */;
INSERT INTO `templates` VALUES
(1,'test','test','{\"time\":1693190443866,\"blocks\":[{\"id\":\"7G_LT1iFlk\",\"type\":\"paragraph\",\"data\":{\"text\":\"Second test document\",\"alignment\":\"left\"}}],\"version\":\"2.27.2\"}',NULL,'2023-08-28 07:18:30','Y');
/*!40000 ALTER TABLE `templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) NOT NULL,
  `email` varchar(128) DEFAULT '',
  `token` varchar(128) DEFAULT '',
  `dttoken` datetime DEFAULT NULL,
  `signaturefullname` varchar(64) DEFAULT '',
  `signatureinitials` varchar(2) DEFAULT '',
  `signaturefontname` varchar(64) DEFAULT '',
  `signaturetoken` varchar(64) DEFAULT '',
  `encryptionkey` varchar(1024) DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `usersaccount` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(48,'5FYib34nmpSpmkarhh2oxuvkVgknNF4QMQAx493zNpmgpj8B','','e7e8c39d179b02402094cfa2b528231375ed47186d38a247dfaf773956256766','2023-08-28 07:30:30','John Doe','JD','fonts/kristi/Kristi.ttf','ceeddd7e556d69bd5e677273a5fc1f4dcbf735ac4ce1d27ec28ca53fd3ba208a',''),
(49,'5C4qhY5c8eiNfzuFHfFrohERpTNBM286KiWB3YTwx6X9aDho','','e5cf8b700f6fcec5b7fa805129091dc8d1f2a4f25515647ad666a335a7618ff9','2023-08-28 06:53:25','','','','7c21cfd1a9ed9cc49a2ddb429ae0e3914c4a4d2b7919e71ba06b205d0f2e9fd9','3gAFqnNhbHRjaGFjaGHEEKYHHdCGm01bKk7UWLazQ4Onc2FsdGFlc8QQnv8iX1Q4yh19PNWpJd0SDKtub25jZWNoYWNoYcQY1g+BtPBbmQEz1NkwBiVz7ZSsYmpwtzCbqG5vbmNlYWVzxBhu0dfg+2K7+zy1R+qMqB5RyWY/9ACJF0OmZW5jbXNnxG3DVpSxCZSGk7xV8KeT9W2GSTaeM+ctfPympb67xr8KauGOiojncCwcWCUKR1yWWNV6FKcM3Z/m2UccbCuY9beACRmPF3JM/rTslvy3mi1QbZEZeTgLU/1wKd0dN6/4q5/6kagjIG+Dfthh6mS+');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

CREATE USER 'testdocsig'@'localhost' IDENTIFIED BY 'As827-1727-1619';
GRANT ALL PRIVILEGES ON testdocsig.* TO 'testdocsig'@'localhost';
FLUSH PRIVILEGES;
