-- JMLP Database Schema - Production exact schema
-- Generated from live database: 2025-10-14
-- MyISAM engine for legacy compatibility

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- SCHEMA DEFINITION
-- ============================================================================

CREATE TABLE `fuj_jmlp_admin` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fuj_jmlp_areal` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3;

CREATE TABLE `fuj_jmlp_category` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_birth_year` int NOT NULL COMMENT 'Nejstarší ročník (např. 1990)',
  `max_birth_year` int NOT NULL COMMENT 'Nejmladší ročník (např. 2005)',
  `active` bit(1) NOT NULL DEFAULT b'1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`name`),
  KEY `idx_active` (`active`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fuj_jmlp_club` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `valid` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3;

CREATE TABLE `fuj_jmlp_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint NOT NULL DEFAULT '0',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_type` enum('document','image','propozice','vysledky','posty','neprirazene') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'neprirazene',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fuj_jmlp_race` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `closed` bit(1) NOT NULL,
  `datum` date DEFAULT NULL,
  `raceNr` varchar(255) DEFAULT NULL,
  `registration` bit(1) NOT NULL,
  `proposition_file_id` bigint DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `results_file_id` bigint DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `areal_id` bigint DEFAULT NULL,
  `organizer_id` bigint DEFAULT NULL,
  `raceCategory_id` bigint NOT NULL,
  `raceMethod_id` bigint NOT NULL,
  `raceType_id` bigint NOT NULL,
  `season_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK8F3E0445F42C58AA` (`raceMethod_id`),
  KEY `FK8F3E0445A3EA720A` (`raceType_id`),
  KEY `FK8F3E04454AD4A38A` (`raceCategory_id`),
  KEY `FK8F3E0445922922EA` (`season_id`),
  KEY `FK8F3E0445A4CC64F1` (`organizer_id`),
  KEY `FK8F3E04458568B4A` (`areal_id`),
  KEY `idx_proposition_file` (`proposition_file_id`),
  KEY `idx_results_file` (`results_file_id`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3;

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
  `category_id` bigint DEFAULT NULL COMMENT 'FK to fuj_jmlp_category',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`,`surname`,`year`,`sex`),
  KEY `ix_racer_club` (`club_id`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3;

CREATE TABLE `fuj_jmlp_visitor_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'IP adresa návštěvníka',
  `user_agent` varchar(255) COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'User agent prohlížeče',
  `path` varchar(255) COLLATE utf8mb4_czech_ci DEFAULT NULL COMMENT 'Navštívená cesta',
  `visited_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Čas návštěvy',
  PRIMARY KEY (`id`),
  KEY `idx_visited_at` (`visited_at`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci COMMENT='Log návštěv webu';

CREATE TABLE `posts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `image_file_id` bigint DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `image_position` varchar(20) DEFAULT 'right',
  `document_file_id` bigint DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_published` (`published`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `race_registration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `race_id` bigint NOT NULL,
  `racer_id` bigint NOT NULL,
  `category_id` bigint DEFAULT NULL COMMENT 'Category snapshot at registration time',
  `registered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_racer` (`race_id`,`racer_id`),
  KEY `ix_reg_race` (`race_id`),
  KEY `ix_reg_racer` (`racer_id`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default admin user (email: admin@jmlp.cz, password: admin123)
-- ⚠️ CHANGE PASSWORD after first deployment!
INSERT INTO `fuj_jmlp_admin` VALUES 
  (1,'admin@jmlp.cz','scrypt:32768:8:1$is0kNTnH6Q5fmokn$b1cbc88d0c0cfb050e43a7187a3201bf0354e57bcb8d1e6f8086a4333f88e11dc5d62f8a698f75325ef864eb374c47480156884bbb613a626793109fbdc0df88','Administrátor JMLP',1,NULL,'2025-10-13 17:20:06','2025-10-13 17:20:06');

-- Sample welcome post
INSERT INTO `posts` VALUES 
  (1,'Vítejte na webu JMLP','Vítáme vás na webu **Jezerní Motolodní Liga Pardubice**.\n\nNa těchto stránkách najdete:\n- Aktuální termínovku závodů\n- Historii závodů v archivu\n- Možnost registrace na závody\n\n*Přejeme příjemné prohlížení!*',NULL,NULL,'right',NULL,1,NOW(),NOW());

SET FOREIGN_KEY_CHECKS = 1;
