CREATE TABLE "contact_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" text,
	CONSTRAINT "contact_messages_size_check" CHECK (length("contact_messages"."name") <= 100 and length("contact_messages"."email") <= 254 and length("contact_messages"."topic") <= 40 and length("contact_messages"."message") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "email_signups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_signups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_signups_email_check" CHECK ("email_signups"."email" = lower("email_signups"."email") and length("email_signups"."email") <= 254)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_signups_email_idx" ON "email_signups" USING btree ("email");