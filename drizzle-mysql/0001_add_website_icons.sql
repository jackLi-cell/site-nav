ALTER TABLE `websites`
  ADD COLUMN `icon_path` varchar(512) NULL AFTER `social_links`,
  ADD COLUMN `icon_source_url` varchar(2048) NULL AFTER `icon_path`,
  ADD COLUMN `icon_mime_type` varchar(120) NULL AFTER `icon_source_url`,
  ADD COLUMN `icon_fetch_status` varchar(20) NULL AFTER `icon_mime_type`,
  ADD COLUMN `icon_fetched_at` varchar(32) NULL AFTER `icon_fetch_status`;
