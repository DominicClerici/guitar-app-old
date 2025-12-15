CREATE TABLE "tab_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" jsonb NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tab_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"tab_data_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tab_information" ADD CONSTRAINT "tab_information_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_information" ADD CONSTRAINT "tab_information_tab_data_id_tab_data_id_fk" FOREIGN KEY ("tab_data_id") REFERENCES "public"."tab_data"("id") ON DELETE cascade ON UPDATE no action;


-- Function to update tab_information.updated_at when tab_data is updated
CREATE OR REPLACE FUNCTION update_tab_information_on_tab_data_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tab_information
  SET updated_at = NOW()
  WHERE tab_data_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for direct updates to tab_information
CREATE TRIGGER trigger_update_tab_information_updated_at
  BEFORE UPDATE ON tab_information
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_information_updated_at();

-- Trigger for updates to tab_data (cascades to tab_information)
CREATE TRIGGER trigger_update_tab_information_on_tab_data_change
  AFTER UPDATE ON tab_data
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_information_on_tab_data_change();
