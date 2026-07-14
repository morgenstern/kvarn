ALTER TABLE `product` ADD `method_hint` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `method_hint` text;--> statement-breakpoint
ALTER TABLE `bean` ADD `bean_type` text;--> statement-breakpoint
ALTER TABLE `recipe` ADD `grinder_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `recipe` ADD `machine_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `brew` ADD `grinder_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `brew` ADD `machine_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
UPDATE `recipe` SET `grinder_equipment_id` = (SELECT `grinder_equipment_id` FROM `setup` WHERE `setup`.`id` = `recipe`.`setup_id`), `machine_equipment_id` = (SELECT `machine_equipment_id` FROM `setup` WHERE `setup`.`id` = `recipe`.`setup_id`);--> statement-breakpoint
UPDATE `brew` SET `grinder_equipment_id` = (SELECT `grinder_equipment_id` FROM `setup` WHERE `setup`.`id` = `brew`.`setup_id`), `machine_equipment_id` = (SELECT `machine_equipment_id` FROM `setup` WHERE `setup`.`id` = `brew`.`setup_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`grinder_equipment_id` text,
	`machine_equipment_id` text,
	`bean_id` text,
	`bean_profile` text,
	`params` text,
	`confidence` real,
	`brew_count` integer DEFAULT 0 NOT NULL,
	`avg_rating` real,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`grinder_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_recipe`("id", "user_id", "grinder_equipment_id", "machine_equipment_id", "bean_id", "bean_profile", "params", "confidence", "brew_count", "avg_rating", "updated_at", "deleted_at", "client_id") SELECT "id", "user_id", "grinder_equipment_id", "machine_equipment_id", "bean_id", "bean_profile", "params", "confidence", "brew_count", "avg_rating", "updated_at", "deleted_at", "client_id" FROM `recipe`;--> statement-breakpoint
DROP TABLE `recipe`;--> statement-breakpoint
ALTER TABLE `__new_recipe` RENAME TO `recipe`;--> statement-breakpoint
CREATE TABLE `__new_brew` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`grinder_equipment_id` text,
	`machine_equipment_id` text,
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
	`is_manual_entry` integer DEFAULT false NOT NULL,
	`recipe_id` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	`client_id` text NOT NULL,
	FOREIGN KEY (`grinder_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weather_id`) REFERENCES `weather_snapshot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_brew`("id", "user_id", "grinder_equipment_id", "machine_equipment_id", "bean_id", "weather_id", "brewed_at", "grind_setting", "dose_g", "target_yield_g", "water_temp_c", "preinfusion_s", "puck_prep", "bean_age_days", "time_total_s", "time_first_drop_s", "pressure_avg_bar", "pressure_peak_bar", "actual_yield_g", "flow_gs", "rating_total", "balance", "sweetness", "body", "crema", "visual_tags", "flavor_tags", "tds_pct", "note", "photo_url", "is_dial_in", "is_manual_entry", "recipe_id", "updated_at", "deleted_at", "client_id") SELECT "id", "user_id", "grinder_equipment_id", "machine_equipment_id", "bean_id", "weather_id", "brewed_at", "grind_setting", "dose_g", "target_yield_g", "water_temp_c", "preinfusion_s", "puck_prep", "bean_age_days", "time_total_s", "time_first_drop_s", "pressure_avg_bar", "pressure_peak_bar", "actual_yield_g", "flow_gs", "rating_total", "balance", "sweetness", "body", "crema", "visual_tags", "flavor_tags", "tds_pct", "note", "photo_url", "is_dial_in", "is_manual_entry", "recipe_id", "updated_at", "deleted_at", "client_id" FROM `brew`;--> statement-breakpoint
DROP TABLE `brew`;--> statement-breakpoint
ALTER TABLE `__new_brew` RENAME TO `brew`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `setup`;
