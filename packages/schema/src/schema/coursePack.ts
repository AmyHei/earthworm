import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { course } from "./course";

export const coursePack = pgTable("course_packs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  isFree: boolean("is_free"),
  cover: text("cover"),
  creatorId: text("creator_id").notNull(),
  shareLevel: text("share_level").default("private"),
  parentId: text("parent_id"),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdateFn(() => new Date()),
});

export const coursePackRelations = relations(coursePack, ({ one, many }) => ({
  courses: many(course),
  children: many(coursePack, {
    relationName: "parentChild",
  }),
  parent: one(coursePack, {
    fields: [coursePack.parentId],
    references: [coursePack.id],
    relationName: "parentChild",
  }),
}));
