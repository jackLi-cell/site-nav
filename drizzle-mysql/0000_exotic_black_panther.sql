CREATE TABLE `categories` (
	`id` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` varchar(500),
	`icon` varchar(32),
	`parent_id` varchar(128),
	`level` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`website_count` int NOT NULL DEFAULT 0,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`cover_image` varchar(2048),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `groups_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalized` varchar(255) NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `keywords_id` PRIMARY KEY(`id`),
	CONSTRAINT `keywords_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `moderation_results` (
	`id` varchar(64) NOT NULL,
	`submission_id` varchar(64) NOT NULL,
	`check_type` varchar(40) NOT NULL,
	`passed` boolean NOT NULL,
	`detail` text,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `moderation_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outbound_click_events` (
	`id` varchar(64) NOT NULL,
	`website_id` varchar(64) NOT NULL,
	`ip_hash` varchar(128) NOT NULL,
	`ua_hash` varchar(128) NOT NULL,
	`user_id` varchar(64),
	`is_valid` boolean NOT NULL DEFAULT true,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `outbound_click_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` varchar(64) NOT NULL,
	`target_type` varchar(20) NOT NULL,
	`target_id` varchar(64) NOT NULL,
	`action` varchar(20) NOT NULL,
	`reviewer_user_id` varchar(64) NOT NULL,
	`before_snapshot` text,
	`after_snapshot` text,
	`reason` text,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `review_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`expires_at` varchar(32) NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_health_checks` (
	`id` varchar(64) NOT NULL,
	`website_id` varchar(64) NOT NULL,
	`status_code` int NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `site_health_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submission_categories` (
	`submission_id` varchar(64) NOT NULL,
	`category_id` varchar(128) NOT NULL,
	CONSTRAINT `submission_categories_submission_id_category_id_pk` PRIMARY KEY(`submission_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `submission_keywords` (
	`submission_id` varchar(64) NOT NULL,
	`keyword_id` varchar(64) NOT NULL,
	CONSTRAINT `submission_keywords_submission_id_keyword_id_pk` PRIMARY KEY(`submission_id`,`keyword_id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`normalized_domain` varchar(255) NOT NULL,
	`short_summary` varchar(500),
	`full_description` text,
	`region` varchar(20) DEFAULT 'china',
	`company` varchar(255),
	`language` varchar(80),
	`is_free` varchar(40),
	`status` varchar(20) NOT NULL DEFAULT 'queued',
	`flag_reason` text,
	`reviewer_user_id` varchar(64),
	`review_note` text,
	`reviewed_at` varchar(32),
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`color` varchar(16),
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'user',
	`contribution_score` int NOT NULL DEFAULT 0,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `website_categories` (
	`website_id` varchar(64) NOT NULL,
	`category_id` varchar(128) NOT NULL,
	CONSTRAINT `website_categories_website_id_category_id_pk` PRIMARY KEY(`website_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `website_groups` (
	`website_id` varchar(64) NOT NULL,
	`group_id` varchar(64) NOT NULL,
	CONSTRAINT `website_groups_website_id_group_id_pk` PRIMARY KEY(`website_id`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `website_keywords` (
	`website_id` varchar(64) NOT NULL,
	`keyword_id` varchar(64) NOT NULL,
	CONSTRAINT `website_keywords_website_id_keyword_id_pk` PRIMARY KEY(`website_id`,`keyword_id`)
);
--> statement-breakpoint
CREATE TABLE `website_tags` (
	`website_id` varchar(64) NOT NULL,
	`tag_id` varchar(64) NOT NULL,
	CONSTRAINT `website_tags_website_id_tag_id_pk` PRIMARY KEY(`website_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `websites` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`normalized_domain` varchar(255) NOT NULL,
	`short_summary` varchar(500),
	`full_description` text,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`region` varchar(20) NOT NULL DEFAULT 'china',
	`star_rating` int NOT NULL DEFAULT 1,
	`view_count` int NOT NULL DEFAULT 0,
	`monthly_visits` bigint DEFAULT 0,
	`company` varchar(255),
	`founder` varchar(255),
	`headquarters` varchar(255),
	`language` varchar(80),
	`is_free` varchar(40),
	`launch_year` int,
	`pricing_model` varchar(255),
	`alternatives` text,
	`target_audience` text,
	`features` text,
	`platforms` text,
	`social_links` text,
	`icon_path` varchar(512),
	`icon_source_url` varchar(2048),
	`icon_mime_type` varchar(120),
	`icon_fetch_status` varchar(20),
	`icon_fetched_at` varchar(32),
	`screenshot_url` varchar(2048),
	`screenshot_at` varchar(32),
	`last_health_check` varchar(32),
	`consecutive_failures` int DEFAULT 0,
	`submitter_user_id` varchar(64),
	`approved_by_user_id` varchar(64),
	`approved_at` varchar(32),
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	CONSTRAINT `websites_id` PRIMARY KEY(`id`),
	CONSTRAINT `websites_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_categories_slug` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_parent` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_categories_level` ON `categories` (`level`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_keywords_normalized` ON `keywords` (`normalized`);--> statement-breakpoint
CREATE INDEX `idx_clicks_website_date` ON `outbound_click_events` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_clicks_dedup_user` ON `outbound_click_events` (`user_id`,`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_clicks_dedup_ip` ON `outbound_click_events` (`ip_hash`,`ua_hash`,`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_review_logs_target` ON `review_logs` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_health_checks_website` ON `site_health_checks` (`website_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_user_status` ON `submissions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status_date` ON `submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_wc_website` ON `website_categories` (`website_id`);--> statement-breakpoint
CREATE INDEX `idx_wc_category` ON `website_categories` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_wk_website` ON `website_keywords` (`website_id`);--> statement-breakpoint
CREATE INDEX `idx_wk_keyword` ON `website_keywords` (`keyword_id`);--> statement-breakpoint
CREATE INDEX `idx_wt_website` ON `website_tags` (`website_id`);--> statement-breakpoint
CREATE INDEX `idx_wt_tag` ON `website_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_websites_slug` ON `websites` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_websites_domain` ON `websites` (`normalized_domain`);--> statement-breakpoint
CREATE INDEX `idx_websites_region_status` ON `websites` (`region`,`status`);--> statement-breakpoint
CREATE INDEX `idx_websites_sort` ON `websites` (`status`,`region`,`view_count`,`name`);--> statement-breakpoint
CREATE INDEX `idx_websites_created` ON `websites` (`status`,`region`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_websites_star` ON `websites` (`status`,`region`,`star_rating`,`view_count`);
