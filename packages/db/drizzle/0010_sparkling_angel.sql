ALTER TABLE "course_packs" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "course_packs" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;