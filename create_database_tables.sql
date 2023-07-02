-- MariaDB dump 10.19  Distrib 10.11.3-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: docusign
-- ------------------------------------------------------
-- Server version	10.11.3-MariaDB-1

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
  PRIMARY KEY (`id`),
  KEY `documentsaccount` (`account`),
  KEY `signersaccounts` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
  PRIMARY KEY (`id`),
  KEY `usersaccount` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2023-07-02 14:38:56
