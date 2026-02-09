CREATE TYPE "public"."learning_paths_enum" AS ENUM('caged');--> statement-breakpoint
CREATE TYPE "public"."lessons_enum" AS ENUM('cagedRoots', 'chordTones', 'cagedPentatonic');--> statement-breakpoint
CREATE TYPE "public"."session_types" AS ENUM('scales', 'arpeggios', 'caged');--> statement-breakpoint
CREATE TYPE "public"."timing_modes" AS ENUM('infinite', 'timed', 'shapes');--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" "learning_paths_enum" NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path" "learning_paths_enum" NOT NULL,
	"lesson" "lessons_enum" NOT NULL,
	"module_id" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "module_completions_user_id_path_lesson_module_id_unique" UNIQUE("user_id","path","lesson","module_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"duration" integer NOT NULL,
	"type" "session_types" NOT NULL,
	"timing_mode" "timing_modes" NOT NULL,
	"keys" text[] NOT NULL,
	"session_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"country" text,
	"bio" text,
	"profile_picture" jsonb DEFAULT '{"path":"","url":""}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_tuning" integer[] DEFAULT '{0,0,0,0,0,0}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_completions" ADD CONSTRAINT "module_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_metadata" ADD CONSTRAINT "users_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;