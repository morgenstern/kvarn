CREATE TABLE `illustration_candidate` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`image_url` text NOT NULL,
	`source_url` text,
	`suitability_score` real,
	`suitability_reason` text,
	`rank` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `illustration_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`candidate_id` text,
	`image_url` text NOT NULL,
	`key_features` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `illustration_candidate`(`id`) ON UPDATE no action ON DELETE no action
);
