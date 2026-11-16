CREATE TABLE "matches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tournament_id" bigint NOT NULL,
	"division_id" bigint NOT NULL,
	"stage" text DEFAULT 'pool' NOT NULL,
	"round" integer NOT NULL,
	"slot" integer NOT NULL,
	"court" integer,
	"starts_at" text,
	"team_a_id" bigint,
	"team_b_id" bigint,
	"score_a" integer,
	"score_b" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_stage_check" CHECK ("matches"."stage" in ('pool', 'qf', 'sf', 'final', 'bronze')),
	CONSTRAINT "matches_status_check" CHECK ("matches"."status" in ('scheduled', 'live', 'final')),
	CONSTRAINT "matches_score_check" CHECK (coalesce("matches"."score_a", 0) between 0 and 99 and coalesce("matches"."score_b", 0) between 0 and 99)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"team_id" bigint NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"dupr" text DEFAULT '' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tournament_id" bigint NOT NULL,
	"division_id" bigint NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_division_idx" ON "matches" USING btree ("division_id","stage","round","slot");--> statement-breakpoint
CREATE INDEX "matches_tournament_idx" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "matches_team_a_idx" ON "matches" USING btree ("team_a_id");--> statement-breakpoint
CREATE INDEX "matches_team_b_idx" ON "matches" USING btree ("team_b_id");--> statement-breakpoint
CREATE INDEX "players_team_idx" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teams_division_idx" ON "teams" USING btree ("division_id","sort");--> statement-breakpoint
CREATE INDEX "teams_tournament_idx" ON "teams" USING btree ("tournament_id");