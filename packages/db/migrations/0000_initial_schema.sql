CREATE TYPE "public"."credibility_band" AS ENUM('trustworthy', 'highly_plausible', 'plausible', 'speculative', 'misguided');--> statement-breakpoint
CREATE TYPE "public"."investigation_event_type" AS ENUM('phase_changed', 'agent_started', 'agent_completed', 'tool_started', 'tool_completed', 'artifact_written', 'error');--> statement-breakpoint
CREATE TYPE "public"."investigation_status" AS ENUM('running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_type" AS ENUM('decision', 'observation', 'finding', 'question', 'hypothesis', 'action', 'counter_evidence');--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('triage', 'trace', 'verdict', 'done');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "agent_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"phase" "phase" NOT NULL,
	"agent_role" text NOT NULL,
	"step_key" text NOT NULL,
	"model_alias" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output_json" jsonb NOT NULL,
	"validation_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dissent_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"counter_argument" text NOT NULL,
	"dissent_strength" numeric(3, 2) NOT NULL,
	"evidence_cited" jsonb NOT NULL,
	"director_response" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dissent_entries_strength_range" CHECK ("dissent_entries"."dissent_strength" >= 0 and "dissent_entries"."dissent_strength" <= 1)
);
--> statement-breakpoint
CREATE TABLE "investigation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "investigation_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_type" "investigation_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" text NOT NULL,
	"status" "investigation_status" NOT NULL,
	"current_phase" "phase" NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"trigger_payload" jsonb NOT NULL,
	"final_report" jsonb,
	"confidence" numeric(3, 2),
	"total_cost_usd" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investigations_confidence_range" CHECK ("investigations"."confidence" is null or ("investigations"."confidence" >= 0 and "investigations"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"phase" "phase" NOT NULL,
	"entry_type" "journal_entry_type" NOT NULL,
	"content" text NOT NULL,
	"priority" "priority",
	"cited_tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cited_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"agent_role" text NOT NULL,
	"model_alias" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"duration_ms" integer NOT NULL,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_calls_input_tokens_nonnegative" CHECK ("llm_calls"."input_tokens" >= 0),
	CONSTRAINT "llm_calls_output_tokens_nonnegative" CHECK ("llm_calls"."output_tokens" >= 0),
	CONSTRAINT "llm_calls_cost_usd_nonnegative" CHECK ("llm_calls"."cost_usd" >= 0),
	CONSTRAINT "llm_calls_duration_ms_nonnegative" CHECK ("llm_calls"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "review_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"expert_name" text NOT NULL,
	"finding_text" text NOT NULL,
	"credibility" numeric(3, 2) NOT NULL,
	"credibility_band" "credibility_band" NOT NULL,
	"cited_tool_calls" jsonb NOT NULL,
	"critic_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_findings_credibility_range" CHECK ("review_findings"."credibility" >= 0 and "review_findings"."credibility" <= 1)
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"event_timestamp" timestamp with time zone NOT NULL,
	"event_text" text NOT NULL,
	"source_findings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_metadata" (
	"investigation_id" uuid PRIMARY KEY NOT NULL,
	"confidence_score" numeric(3, 2),
	"evidence_gaps" jsonb
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"expert_name" text NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dissent_entries" ADD CONSTRAINT "dissent_entries_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_events" ADD CONSTRAINT "investigation_events_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_metadata" ADD CONSTRAINT "timeline_metadata_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_outputs_investigation_round" ON "agent_outputs" USING btree ("investigation_id","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_agent_outputs_investigation_step_key" ON "agent_outputs" USING btree ("investigation_id","step_key");--> statement-breakpoint
CREATE INDEX "idx_events_investigation_sequence" ON "investigation_events" USING btree ("investigation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_events_investigation_sequence" ON "investigation_events" USING btree ("investigation_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_journal_investigation_round" ON "journal_entries" USING btree ("investigation_id","round_number");--> statement-breakpoint
CREATE INDEX "idx_review_investigation_round" ON "review_findings" USING btree ("investigation_id","round_number");--> statement-breakpoint
CREATE INDEX "idx_tool_calls_investigation" ON "tool_calls" USING btree ("investigation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_tool_calls_investigation_step_key" ON "tool_calls" USING btree ("investigation_id","step_key");