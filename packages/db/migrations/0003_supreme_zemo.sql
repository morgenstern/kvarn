ALTER TABLE `equipment` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `setup` ADD `bean_id` text REFERENCES bean(id);