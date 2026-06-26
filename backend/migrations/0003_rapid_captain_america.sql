CREATE TABLE `vuln_match_edge` (
	`org_id` text NOT NULL,
	`source` text NOT NULL,
	`identity_kind` text NOT NULL,
	`identity_value` text NOT NULL,
	`cve_id` text NOT NULL,
	PRIMARY KEY(`org_id`, `source`, `identity_kind`, `identity_value`, `cve_id`),
	FOREIGN KEY (`org_id`,`source`,`identity_kind`,`identity_value`) REFERENCES `vuln_source_match`(`org_id`,`source`,`identity_kind`,`identity_value`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vuln_match_edge_cve` ON `vuln_match_edge` (`org_id`,`cve_id`);--> statement-breakpoint
CREATE TABLE `vuln_source_cve` (
	`org_id` text NOT NULL,
	`source` text NOT NULL,
	`cve_id` text NOT NULL,
	`payload` text,
	`fetched_at` integer,
	`expires_at` integer,
	`last_attempt_at` integer NOT NULL,
	`last_status` text NOT NULL,
	`last_error` text,
	PRIMARY KEY(`org_id`, `source`, `cve_id`)
);
--> statement-breakpoint
CREATE TABLE `vuln_source_match` (
	`org_id` text NOT NULL,
	`source` text NOT NULL,
	`identity_kind` text NOT NULL,
	`identity_value` text NOT NULL,
	`fetched_at` integer,
	`expires_at` integer,
	`last_attempt_at` integer NOT NULL,
	`last_status` text NOT NULL,
	`last_error` text,
	PRIMARY KEY(`org_id`, `source`, `identity_kind`, `identity_value`)
);
--> statement-breakpoint
CREATE INDEX `idx_vuln_source_match_org` ON `vuln_source_match` (`org_id`);