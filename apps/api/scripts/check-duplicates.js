const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { config } = require("dotenv");
const { eq, and } = require("drizzle-orm");

// Load environment variables
config({ path: "../../../.env" });

const { coursePack, course, statement } = require("../../../packages/schema/dist/index.js");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5434/earthworm";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function checkDuplicates() {
  try {
    console.log("Checking for duplicate course packs...");

    // Check for duplicates with title "1600分类单词"
    const level1Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    console.log(`Found ${level1Packs.length} Level 1 course packs with title "1600分类单词":`);
    level1Packs.forEach((pack) => {
      console.log(
        `- ID: ${pack.id}, Title: ${pack.title}, Level: ${pack.level}, Order: ${pack.order}`,
      );
    });

    // Check all course packs by level
    console.log("\nAll course packs by level:");
    for (let level = 1; level <= 3; level++) {
      const packs = await db.select().from(coursePack).where(eq(coursePack.level, level));
      console.log(`Level ${level}: ${packs.length} course packs`);
      if (level === 1) {
        packs.forEach((pack) => {
          console.log(`  - ${pack.title} (ID: ${pack.id})`);
        });
      }
    }

    // Check for orphaned course packs (Level 2/3 without proper parent)
    console.log("\nChecking for orphaned course packs...");
    const level2Packs = await db.select().from(coursePack).where(eq(coursePack.level, 2));
    const level3Packs = await db.select().from(coursePack).where(eq(coursePack.level, 3));

    for (const pack of level2Packs) {
      if (pack.parentId && !level1Packs.find((p) => p.id === pack.parentId)) {
        console.log(`Orphaned Level 2 pack: ${pack.title} (parent: ${pack.parentId})`);
      }
    }

    for (const pack of level3Packs) {
      if (pack.parentId && !level2Packs.find((p) => p.id === pack.parentId)) {
        console.log(`Orphaned Level 3 pack: ${pack.title} (parent: ${pack.parentId})`);
      }
    }

    // Check courses and statements
    console.log("\nCourse and statement counts:");
    const courses = await db.select().from(course);
    const statements = await db.select().from(statement);
    console.log(`Total courses: ${courses.length}`);
    console.log(`Total statements: ${statements.length}`);
  } catch (error) {
    console.error("Error checking duplicates:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkDuplicates();
}

module.exports = { checkDuplicates };
