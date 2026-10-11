
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_admin` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `role` enum('admin','timekeeper') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_areal` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_attachment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `file_id` bigint NOT NULL,
  `owner_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` bigint DEFAULT NULL,
  `role` varchar(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `published` tinyint(1) NOT NULL DEFAULT '1',
  `is_generated` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_attachment_owner` (`owner_type`,`owner_id`),
  KEY `idx_attachment_file` (`file_id`),
  KEY `idx_attachment_role` (`role`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_category` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_birth_year` int NOT NULL COMMENT 'NejstarÅ¡Ã­ roÄnÃ­k (napÅ™. 1990)',
  `max_birth_year` int NOT NULL COMMENT 'NejmladÅ¡Ã­ roÄnÃ­k (napÅ™. 2005)',
  `sex` smallint NOT NULL DEFAULT '0' COMMENT '0=mix, 1=muÅ¾i, 2=Å¾eny',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `display_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name_sex` (`name`,`sex`),
  KEY `idx_active` (`active`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_club` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `valid` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_filename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint NOT NULL DEFAULT '0',
  `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_type` enum('document','image','propozice','vysledky','posty','neprirazene') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'neprirazene',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_posts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image_position` varchar(20) DEFAULT 'right',
  `published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_posts_published` (`published`),
  KEY `ix_posts_created` (`created_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_race` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `closed` bit(1) NOT NULL,
  `datum` date DEFAULT NULL,
  `race_nr` varchar(255) DEFAULT NULL,
  `registration` bit(1) NOT NULL,
  `timekeeper_category_order` varchar(1000) DEFAULT NULL,
  `areal_id` bigint DEFAULT NULL,
  `organizer_id` bigint DEFAULT NULL,
  `race_method_id` bigint NOT NULL,
  `season_id` bigint NOT NULL,
  `is_live` tinyint(1) NOT NULL DEFAULT '0',
  `race_director` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `technical_delegate` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chief_timekeeper` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `run_count` tinyint NOT NULL DEFAULT '1',
  `is_final` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FK8F3E0445F42C58AA` (`race_method_id`),
  KEY `FK8F3E0445922922EA` (`season_id`),
  KEY `FK8F3E0445A4CC64F1` (`organizer_id`),
  KEY `FK8F3E04458568B4A` (`areal_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_race_numbers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `set_number` int NOT NULL COMMENT 'ÄŒÃ­slo sady (1, 2, 3...)',
  `set_color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rose',
  `actual_number` int NOT NULL COMMENT 'SkuteÄnÃ© ÄÃ­slo na dresu (1-200)',
  `display_number` int NOT NULL COMMENT 'ÄŒÃ­slo pro zobrazenÃ­ (201-400 pro sadu 2)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_display` (`display_number`),
  UNIQUE KEY `uq_race_numbers_set_actual` (`set_number`,`actual_number`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_race_registration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `race_id` bigint NOT NULL,
  `racer_id` bigint NOT NULL,
  `category_id` bigint DEFAULT NULL,
  `registered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `club_request_note` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_racer` (`race_id`,`racer_id`),
  KEY `ix_reg_race` (`race_id`),
  KEY `ix_reg_racer` (`racer_id`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_race_run` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `race_id` bigint NOT NULL,
  `run_number` tinyint NOT NULL,
  `course_setter` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gates_count` int DEFAULT NULL,
  `conditions` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_time` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course_length_m` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_run` (`race_id`,`run_number`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_race_start_list` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `race_id` bigint NOT NULL,
  `racer_id` bigint NOT NULL,
  `category_id` bigint DEFAULT NULL,
  `start_number` int DEFAULT NULL,
  `race_number_id` bigint DEFAULT NULL,
  `racer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `racer_surname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `racer_year` int DEFAULT NULL,
  `racer_sex` smallint DEFAULT NULL,
  `club_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category_sex` smallint DEFAULT NULL,
  `race_number_actual` int DEFAULT NULL,
  `race_number_display` int DEFAULT NULL,
  `time1` decimal(10,2) DEFAULT NULL,
  `time2` decimal(10,2) DEFAULT NULL,
  `time_sum` decimal(10,2) DEFAULT NULL,
  `dnf` tinyint(1) DEFAULT '0',
  `dns` tinyint(1) DEFAULT '0',
  `dsq` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `points` int DEFAULT NULL COMMENT 'Body za umisteni v zavode',
  `name_override` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `surname_override` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year_override` int DEFAULT NULL,
  `excluded` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_racer_startlist` (`race_id`,`racer_id`),
  UNIQUE KEY `uq_start_list_race_number` (`race_id`,`race_number_id`),
  KEY `idx_race_id` (`race_id`),
  KEY `idx_racer_id` (`racer_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_race_number` (`race_number_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_racer` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(25) DEFAULT NULL,
  `sex` smallint NOT NULL,
  `surname` varchar(30) NOT NULL,
  `year` int NOT NULL,
  `telefon` varchar(30) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `slcr_id` varchar(10) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `club_id` bigint DEFAULT NULL,
  `category_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`,`surname`,`year`,`sex`),
  KEY `ix_racer_club` (`club_id`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;
CREATE TABLE `fuj_jmlp_slcr_member` (
  `member_id` int NOT NULL,
  `slug` varchar(160) DEFAULT NULL,
  `race_code` int DEFAULT NULL,
  `surname` varchar(80) DEFAULT NULL,
  `name` varchar(80) DEFAULT NULL,
  `year` int DEFAULT NULL,
  PRIMARY KEY (`member_id`),
  KEY `ix_slcr_member_code` (`race_code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_season` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `year_start` int NOT NULL,
  `year_end` int NOT NULL,
  `edition` int DEFAULT NULL,
  `name` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_year` (`year_start`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_timekeeper_idempotency` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `idempotency_key` varchar(128) NOT NULL,
  `admin_id` bigint NOT NULL,
  `method` varchar(10) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `response_json` longtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_timekeeper_idempotency` (`idempotency_key`,`admin_id`,`method`,`endpoint`),
  KEY `idx_timekeeper_idempotency_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuj_jmlp_visitor_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'IP adresa nÃ¡vÅ¡tÄ›vnÃ­ka',
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'User agent prohlÃ­Å¾eÄe',
  `path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'NavÅ¡tÃ­venÃ¡ cesta',
  `visited_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ÄŒas nÃ¡vÅ¡tÄ›vy',
  PRIMARY KEY (`id`),
  KEY `idx_visited_at` (`visited_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='Log nÃ¡vÅ¡tÄ›v webu';
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `today_unique_visits` AS SELECT 
 1 AS `unique_ip_count`*/;
SET character_set_client = @saved_cs_client;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_visits` AS SELECT 
 1 AS `id`,
 1 AS `ip_address`,
 1 AS `user_agent`,
 1 AS `path`,
 1 AS `visited_at`,
 1 AS `visit_date`,
 1 AS `visit_hour`,
 1 AS `visit_minute`,
 1 AS `weekday_num`,
 1 AS `weekday_name`*/;
SET character_set_client = @saved_cs_client;
/*!50001 DROP VIEW IF EXISTS `today_unique_visits`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = latin1 */;
/*!50001 SET character_set_results     = latin1 */;
/*!50001 SET collation_connection      = latin1_swedish_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`app`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `today_unique_visits` AS select count(distinct `fuj_jmlp_visitor_log`.`ip_address`) AS `unique_ip_count` from `fuj_jmlp_visitor_log` where (`fuj_jmlp_visitor_log`.`visited_at` >= curdate()) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `v_visits`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`app`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_visits` AS select `fuj_jmlp_visitor_log`.`id` AS `id`,`fuj_jmlp_visitor_log`.`ip_address` AS `ip_address`,`fuj_jmlp_visitor_log`.`user_agent` AS `user_agent`,`fuj_jmlp_visitor_log`.`path` AS `path`,`fuj_jmlp_visitor_log`.`visited_at` AS `visited_at`,cast(`fuj_jmlp_visitor_log`.`visited_at` as date) AS `visit_date`,hour(`fuj_jmlp_visitor_log`.`visited_at`) AS `visit_hour`,minute(`fuj_jmlp_visitor_log`.`visited_at`) AS `visit_minute`,weekday(`fuj_jmlp_visitor_log`.`visited_at`) AS `weekday_num`,dayname(`fuj_jmlp_visitor_log`.`visited_at`) AS `weekday_name` from `fuj_jmlp_visitor_log` where (not((`fuj_jmlp_visitor_log`.`path` like '/admin%'))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

