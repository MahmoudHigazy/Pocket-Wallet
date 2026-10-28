CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`initial_balance` integer DEFAULT 0 NOT NULL,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`exclude_from_stats` integer DEFAULT false NOT NULL,
	`card_last4` text DEFAULT '[]' NOT NULL,
	`members` text
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`category_ids` text DEFAULT '[]' NOT NULL,
	`account_ids` text DEFAULT '[]' NOT NULL,
	`label_ids` text DEFAULT '[]' NOT NULL,
	`rollover` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`icon` text,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `dividends` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`instrument_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`date` integer NOT NULL,
	`rate` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`kind` text NOT NULL,
	`raw_text` text,
	`draft` text,
	`confidence` real,
	`status` text DEFAULT 'new' NOT NULL,
	`linked_record_id` text
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`symbol` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text,
	`sector` text,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table` text NOT NULL,
	`doc_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payees` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`default_category_id` text
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`instrument_id` text NOT NULL,
	`date` integer NOT NULL,
	`close` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`ref_amount` integer,
	`category_id` text,
	`payee` text,
	`note` text,
	`date` integer NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`payment_type` text,
	`status` text DEFAULT 'cleared' NOT NULL,
	`transfer_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`attachment_uris` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_account_date_idx` ON `records` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `records_source_ref_idx` ON `records` (`source_ref`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`match` text NOT NULL,
	`set` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`collection` text PRIMARY KEY NOT NULL,
	`last_pulled_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`side` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`fees` integer DEFAULT 0 NOT NULL,
	`date` integer NOT NULL,
	`note` text
);
