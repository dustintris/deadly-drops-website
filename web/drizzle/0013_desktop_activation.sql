CREATE TABLE "desktop_activation_codes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "desktop_activation_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"install_row_id" bigint,
	CONSTRAINT "desktop_activation_codes_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "desktop_activation_codes_size_check" CHECK (length("desktop_activation_codes"."label") between 1 and 60 and length("desktop_activation_codes"."code_hash") = 64 and length("desktop_activation_codes"."created_by") <= 254 and "desktop_activation_codes"."expires_at" > "desktop_activation_codes"."created_at")
);
--> statement-breakpoint
CREATE TABLE "desktop_installs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "desktop_installs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"install_id" text NOT NULL,
	"device_name" text DEFAULT '' NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_version" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "desktop_installs_key_hash_unique" UNIQUE("key_hash"),
	CONSTRAINT "desktop_installs_size_check" CHECK (length("desktop_installs"."label") between 1 and 60 and length("desktop_installs"."install_id") between 1 and 64 and length("desktop_installs"."device_name") <= 80 and length("desktop_installs"."key_hash") = 64 and length("desktop_installs"."created_by") <= 254 and coalesce(length("desktop_installs"."last_version"), 0) <= 32)
);
--> statement-breakpoint
ALTER TABLE "desktop_activation_codes" ADD CONSTRAINT "desktop_activation_codes_install_row_id_desktop_installs_id_fk" FOREIGN KEY ("install_row_id") REFERENCES "public"."desktop_installs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desktop_activation_codes_install_idx" ON "desktop_activation_codes" USING btree ("install_row_id");--> statement-breakpoint
CREATE INDEX "desktop_activation_codes_open_idx" ON "desktop_activation_codes" USING btree ("expires_at") WHERE "desktop_activation_codes"."used_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_installs_active_install_idx" ON "desktop_installs" USING btree ("install_id") WHERE "desktop_installs"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "desktop_installs_revoked_idx" ON "desktop_installs" USING btree ("revoked_at" DESC NULLS LAST) WHERE "desktop_installs"."revoked_at" is not null;