CREATE TABLE "users_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_tuning" integer[] DEFAULT '{0,0,0,0,0,0}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users_metadata" ADD CONSTRAINT "users_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;