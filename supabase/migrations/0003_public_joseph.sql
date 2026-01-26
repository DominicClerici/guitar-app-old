ALTER TABLE "user_profile" ALTER COLUMN "profile_picture" SET DEFAULT '{"path":"","url":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "profile_picture" SET NOT NULL;