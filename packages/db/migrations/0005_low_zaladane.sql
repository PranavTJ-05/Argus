CREATE TYPE "public"."workspace_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "status" "workspace_status" DEFAULT 'active' NOT NULL;