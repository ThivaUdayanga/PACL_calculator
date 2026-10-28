-- ========================================================
-- PACL Jar Test Records Table Schema
-- Database: `pacl_calculator`
-- Compatible with MariaDB 10.2+ & MySQL 5.7+
-- ========================================================

CREATE TABLE IF NOT EXISTS `jar_test_records` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ph` DECIMAL(4, 2) NOT NULL COMMENT 'Water pH (e.g. 6.60)',
  `turbidity` DECIMAL(6, 2) NOT NULL COMMENT 'Turbidity in NTU (e.g. 15.40)',
  `pacl` DECIMAL(6, 2) NOT NULL COMMENT 'PACL Dosage in ppm / mg/L (e.g. 0.55)',
  `test_date` VARCHAR(50) DEFAULT 'Lab Series' COMMENT 'Test Date or Reference label (e.g. 01-Oct, Historical)',
  `status` VARCHAR(30) DEFAULT 'Verified' COMMENT 'Record status (Verified, Pending, etc.)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  PRIMARY KEY (`id`),
  INDEX `idx_ph_turbidity` (`ph`, `turbidity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
