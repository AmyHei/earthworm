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

async function checkSpecificCategory() {
  try {
    // 找到"1600分类单词"的ID
    const level1Pack = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (level1Pack.length === 0) {
      console.log("No 1600分类单词 found");
      return;
    }

    const mainPackId = level1Pack[0].id;
    console.log(`Found main pack: ${mainPackId}`);

    // 找到所有Level 2分类
    const level2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    console.log(`\nLevel 2 categories (${level2Packs.length}):`);
    for (const pack of level2Packs) {
      console.log(`- ${pack.title} (ID: ${pack.id})`);
    }

    // 找到"家庭与人物称呼及职业职务"分类
    const targetCategory = level2Packs.find((p) => p.title.includes("家庭与人物称呼及职业职务"));
    if (!targetCategory) {
      console.log("\nTarget category not found!");
      return;
    }

    console.log(`\nTarget category: ${targetCategory.title} (${targetCategory.id})`);

    // 找到这个分类下的所有Level 3子分类
    const level3Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, targetCategory.id), eq(coursePack.level, 3)));

    console.log(`\nLevel 3 subcategories (${level3Packs.length}):`);
    for (const pack of level3Packs) {
      // 检查每个子分类下有多少课程
      const courses = await db.select().from(course).where(eq(course.coursePackId, pack.id));
      console.log(`- ${pack.title} (ID: ${pack.id}, ${courses.length} courses)`);

      if (courses.length > 0) {
        // 检查第一个课程有多少语句
        const statements = await db
          .select()
          .from(statement)
          .where(eq(statement.courseId, courses[0].id));
        console.log(`  └─ First course: ${courses[0].title} (${statements.length} statements)`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkSpecificCategory();
}

module.exports = { checkSpecificCategory };
