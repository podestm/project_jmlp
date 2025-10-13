-- JMLP Database Schema and Initial Data
-- MyISAM engine for legacy compatibility

CREATE TABLE `fuj_jmlp_racer` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(25) DEFAULT NULL,
  `sex` smallint(6) NOT NULL,
  `surname` varchar(30) NOT NULL,
  `year` int(11) NOT NULL,
  `telefon` varchar(30) DEFAULT NULL,
  `slcr_id` varchar(10) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `club_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`,`surname`,`year`,`sex`),
  KEY `ix_racer_club` (`club_id`)
) ENGINE=MyISAM AUTO_INCREMENT=2204 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE `fuj_jmlp_race` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `closed` bit(1) NOT NULL,
  `datum` date DEFAULT NULL,
  `raceNr` varchar(255) DEFAULT NULL,
  `registration` bit(1) NOT NULL,
  `proposition_file_id` bigint(20) DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `results_file_id` bigint(20) DEFAULT NULL COMMENT 'FK to fuj_jmlp_files',
  `areal_id` bigint(20) DEFAULT NULL,
  `organizer_id` bigint(20) DEFAULT NULL,
  `raceCategory_id` bigint(20) NOT NULL,
  `raceMethod_id` bigint(20) NOT NULL,
  `raceType_id` bigint(20) NOT NULL,
  `season_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK8F3E0445F42C58AA` (`raceMethod_id`),
  KEY `FK8F3E0445A3EA720A` (`raceType_id`),
  KEY `FK8F3E04454AD4A38A` (`raceCategory_id`),
  KEY `FK8F3E0445922922EA` (`season_id`),
  KEY `FK8F3E0445A4CC64F1` (`organizer_id`),
  KEY `FK8F3E04458568B4A` (`areal_id`),
  KEY `idx_proposition_file` (`proposition_file_id`),
  KEY `idx_results_file` (`results_file_id`)
) ENGINE=MyISAM AUTO_INCREMENT=106 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE `fuj_jmlp_areal` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=26 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE `fuj_jmlp_club` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `valid` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=180 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Minimal seed data to have something to display
INSERT INTO `fuj_jmlp_club` (`name`, `valid`) VALUES
  ('SKI Klub A', 1),
  ('SKI Klub B', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `fuj_jmlp_areal` (`name`) VALUES
  ('Areal Harrachov'),
  ('Areal Špindl')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `fuj_jmlp_racer` (`name`, `surname`, `sex`, `year`, `telefon`, `slcr_id`, `club_id`) VALUES
  ('Jan', 'Novák', 1, 2008, NULL, NULL, 1),
  ('Petr', 'Svoboda', 1, 2010, NULL, NULL, 2),
  ('Eva', 'Dvořáková', 2, 2009, NULL, NULL, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `fuj_jmlp_race` (`closed`, `datum`, `raceNr`, `registration`, `proposition_file_id`, `results_file_id`, `areal_id`, `organizer_id`, `raceCategory_id`, `raceMethod_id`, `raceType_id`, `season_id`) VALUES
  (b'0', CURDATE() + INTERVAL 7 DAY, 'JMLP-001', b'1', NULL, NULL, 1, NULL, 1, 1, 1, 2025),
  (b'0', CURDATE() + INTERVAL 14 DAY, 'JMLP-002', b'1', NULL, NULL, 2, NULL, 1, 1, 1, 2025);

-- Registration table (not part of original dump, required for app functionality)
CREATE TABLE IF NOT EXISTS `race_registration` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `race_id` bigint(20) NOT NULL,
  `racer_id` bigint(20) NOT NULL,
  `registered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_racer` (`race_id`,`racer_id`),
  KEY `ix_reg_race` (`race_id`),
  KEY `ix_reg_racer` (`racer_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Posts (aktuality) table for homepage
CREATE TABLE IF NOT EXISTS `posts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_posts_published` (`published`),
  KEY `ix_posts_created` (`created_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Extended admin users table with more fields
CREATE TABLE IF NOT EXISTS `fuj_jmlp_admin` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- File uploads table (propozice, vysledky, images, documents)
CREATE TABLE IF NOT EXISTS `fuj_jmlp_files` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint(20) NOT NULL DEFAULT 0,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_type` enum('document','image','propozice','vysledky','posty','neprirazene') NOT NULL DEFAULT 'neprirazene',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample posts data
INSERT INTO `posts` (`title`, `content`, `image_path`, `published`) VALUES
  ('Vítejte na webu JMLP', 'Vítáme vás na novém webu **Jihomoravské lyžařské ligy**.\n\nNa těchto stránkách najdete:\n- Aktuální termínovku závodů\n- Historii závodů v archivu\n- Důležité dokumenty ke stažení\n\n*Přejeme příjemné prohlížení!*', NULL, 1),
  ('Registrace na zimní závody', 'Zahájili jsme registrace na **zimní sezónu 2025/26**.\n\nRegistrovat se můžete na jednotlivé závody v sekci Termínovka.\n\nNezapomeňte si stáhnout propozice před závodem!', NULL, 1)
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Default admin user (email: admin@jmlp.cz, password: admin123)
-- ⚠️ CHANGE PASSWORD after first deployment!
-- Password hash for 'admin123' using werkzeug scrypt (default method)
INSERT INTO `fuj_jmlp_admin` (`email`, `password_hash`, `full_name`, `is_active`) VALUES
  ('admin@jmlp.cz', 'scrypt:32768:8:1$is0kNTnH6Q5fmokn$b1cbc88d0c0cfb050e43a7187a3201bf0354e57bcb8d1e6f8086a4333f88e11dc5d62f8a698f75325ef864eb374c47480156884bbb613a626793109fbdc0df88', 'Administrátor JMLP', 1)
ON DUPLICATE KEY UPDATE `email`=VALUES(`email`);
