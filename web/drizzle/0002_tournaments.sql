CREATE TABLE "app_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "divisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tournament_id" bigint NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"day_index" integer DEFAULT 0 NOT NULL,
	"start_time" text NOT NULL,
	"minutes_per_round" integer DEFAULT 17 NOT NULL,
	"first_court" integer DEFAULT 1 NOT NULL,
	"court_count" integer DEFAULT 1 NOT NULL,
	"team_limit" integer,
	"games_to" integer,
	"games_per_team" integer,
	"playoffs" text DEFAULT 'none' NOT NULL,
	"bronze" text DEFAULT 'standings' NOT NULL,
	CONSTRAINT "divisions_format_check" CHECK ("divisions"."format" in ('mixed', 'mens', 'womens', 'open')),
	CONSTRAINT "divisions_playoffs_check" CHECK ("divisions"."playoffs" in ('none', 'top4', 'top8')),
	CONSTRAINT "divisions_bronze_check" CHECK ("divisions"."bronze" in ('standings', 'match')),
	CONSTRAINT "divisions_start_time_check" CHECK ("divisions"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tournaments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"days" date[] DEFAULT '{}'::date[] NOT NULL,
	"info" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"live_version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "divisions_tournament_idx" ON "divisions" USING btree ("tournament_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_one_featured_idx" ON "tournaments" USING btree ("featured") WHERE "tournaments"."featured";