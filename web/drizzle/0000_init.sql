CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"who" text NOT NULL,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_documents" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_documents_key_check" CHECK ("site_documents"."key" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "site_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "site_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"data" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
