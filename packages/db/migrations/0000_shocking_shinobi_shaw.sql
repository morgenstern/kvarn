CREATE TABLE `bean` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`roaster` text NOT NULL,
	`name` text NOT NULL,
	`origin` text,
	`variety` text,
	`process` text,
	`roast_level` integer,
	`roast_date` text,
	`opened_at` text,
	`photo_url` text,
	`barcode` text,
	`archived` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brew` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`setup_id` text NOT NULL,
	`bean_id` text NOT NULL,
	`weather_id` text,
	`brewed_at` text NOT NULL,
	`grind_setting` real NOT NULL,
	`dose_g` real NOT NULL,
	`target_yield_g` real NOT NULL,
	`water_temp_c` real,
	`preinfusion_s` real,
	`puck_prep` text,
	`bean_age_days` integer,
	`time_total_s` real NOT NULL,
	`time_first_drop_s` real,
	`pressure_avg_bar` real,
	`pressure_peak_bar` real,
	`actual_yield_g` real,
	`flow_gs` real,
	`rating_total` real NOT NULL,
	`balance` integer,
	`sweetness` integer,
	`body` integer,
	`crema` integer,
	`visual_tags` text DEFAULT '[]',
	`flavor_tags` text DEFAULT '[]',
	`tds_pct` real,
	`note` text,
	`photo_url` text,
	`is_dial_in` integer DEFAULT false NOT NULL,
	`recipe_id` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`setup_id`) REFERENCES `setup`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weather_id`) REFERENCES `weather_snapshot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text,
	`custom_name` text,
	`notes` text,
	`burr_kg` real,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`image_url` text,
	`grind_scale` text,
	`specs` text,
	`status` text DEFAULT 'seed' NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`setup_id` text NOT NULL,
	`bean_id` text,
	`bean_profile` text,
	`params` text,
	`confidence` real,
	`brew_count` integer DEFAULT 0 NOT NULL,
	`avg_rating` real,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`setup_id`) REFERENCES `setup`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `setup` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`method` text NOT NULL,
	`grinder_equipment_id` text NOT NULL,
	`machine_equipment_id` text,
	`accessory_equipment_ids` text DEFAULT '[]',
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`grinder_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weather_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`taken_at` text NOT NULL,
	`temp_c` real,
	`humidity_pct` real,
	`pressure_hpa` real,
	`source` text NOT NULL,
	`geo_cell` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL
);
