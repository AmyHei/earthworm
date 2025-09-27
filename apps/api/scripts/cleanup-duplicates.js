const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { config } = require("dotenv");
const { eq, and, inArray } = require("drizzle-orm");

// Load environment variables
config({ path: "../../../.env" });

const { coursePack, course, statement } = require("../../../packages/schema/dist/index.js");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5434/earthworm";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function cleanupDuplicates() {
  try {
    console.log('Starting cleanup of duplicate "1600分类单词" course packs...');

    // Find all "1600分类单词" level 1 course packs
    const level1Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (level1Packs.length <= 1) {
      console.log("No duplicates found to clean up.");
      return;
    }

    console.log(`Found ${level1Packs.length} duplicate course packs:`);
    level1Packs.forEach((pack, index) => {
      console.log(
        `${index + 1}. ID: ${pack.id}, Created: ${pack.createdAt || "unknown"}, Order: ${pack.order}`,
      );
    });

    // Keep the first one (or the one with children), delete others
    let packToKeep = level1Packs[0];

    // Check which one has children (Level 2 course packs)
    for (const pack of level1Packs) {
      const children = await db.select().from(coursePack).where(eq(coursePack.parentId, pack.id));
      console.log(`Pack ${pack.id} has ${children.length} children`);

      if (children.length > 0) {
        packToKeep = pack;
        break;
      }
    }

    const packsToDelete = level1Packs.filter((pack) => pack.id !== packToKeep.id);
    console.log(`\nKeeping: ${packToKeep.id}`);
    console.log(`Deleting: ${packsToDelete.map((p) => p.id).join(", ")}`);

    // For each pack to delete, we need to clean up all related data
    for (const packToDelete of packsToDelete) {
      console.log(`\nCleaning up pack: ${packToDelete.id}`);

      // Find all Level 2 children
      const level2Children = await db
        .select()
        .from(coursePack)
        .where(eq(coursePack.parentId, packToDelete.id));
      console.log(`Found ${level2Children.length} Level 2 children`);

      for (const level2Child of level2Children) {
        // Find all Level 3 children
        const level3Children = await db
          .select()
          .from(coursePack)
          .where(eq(coursePack.parentId, level2Child.id));
        console.log(`Level 2 pack ${level2Child.id} has ${level3Children.length} Level 3 children`);

        for (const level3Child of level3Children) {
          // Find and delete courses and statements
          const courses = await db
            .select()
            .from(course)
            .where(eq(course.coursePackId, level3Child.id));
          console.log(`Level 3 pack ${level3Child.id} has ${courses.length} courses`);

          for (const courseItem of courses) {
            // Delete statements first
            const deleteStatementsResult = await db
              .delete(statement)
              .where(eq(statement.courseId, courseItem.id));
            console.log(`Deleted statements for course ${courseItem.id}`);
          }

          // Delete courses
          if (courses.length > 0) {
            await db.delete(course).where(eq(course.coursePackId, level3Child.id));
            console.log(`Deleted ${courses.length} courses for Level 3 pack ${level3Child.id}`);
          }
        }

        // Delete Level 3 course packs
        if (level3Children.length > 0) {
          const level3Ids = level3Children.map((p) => p.id);
          await db.delete(coursePack).where(inArray(coursePack.id, level3Ids));
          console.log(`Deleted ${level3Children.length} Level 3 course packs`);
        }
      }

      // Delete Level 2 course packs
      if (level2Children.length > 0) {
        const level2Ids = level2Children.map((p) => p.id);
        await db.delete(coursePack).where(inArray(coursePack.id, level2Ids));
        console.log(`Deleted ${level2Children.length} Level 2 course packs`);
      }

      // Finally delete the Level 1 course pack
      await db.delete(coursePack).where(eq(coursePack.id, packToDelete.id));
      console.log(`Deleted Level 1 course pack ${packToDelete.id}`);
    }

    console.log("\nCleanup completed successfully!");

    // Verify the result
    const remainingLevel1Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));
    console.log(`\nRemaining "1600分类单词" course packs: ${remainingLevel1Packs.length}`);
  } catch (error) {
    console.error("Error during cleanup:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  cleanupDuplicates()
    .then(() => {
      console.log("Cleanup script finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup script failed:", error);
      process.exit(1);
    });
}

module.exports = { cleanupDuplicates };
