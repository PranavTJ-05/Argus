CREATE TYPE "public"."workspace_integration_provider" AS ENUM('github', 'prometheus', 'loki', 'tempo', 'launchdarkly');--> statement-breakpoint
CREATE TYPE "public"."workspace_integration_status" AS ENUM('connected', 'disabled');--> statement-breakpoint
CREATE TABLE "workspace_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "workspace_integration_provider" NOT NULL,
	"status" "workspace_integration_status" DEFAULT 'connected' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"secret_key_hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_workspace_integrations_workspace_provider" ON "workspace_integrations" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "idx_workspace_integrations_workspace" ON "workspace_integrations" USING btree ("workspace_id");