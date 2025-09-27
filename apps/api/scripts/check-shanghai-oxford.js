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

async function checkShanghaiOxford() {
  try {
    // 找到"上海牛津英语"
    const shanghaiOxford = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "上海牛津英语-沪教版"), eq(coursePack.level, 1)));

    if (shanghaiOxford.length === 0) {
      console.log("No 上海牛津英语-沪教版 found");
      return;
    }

    const mainPackId = shanghaiOxford[0].id;
    console.log(`Found Shanghai Oxford: ${mainPackId}`);

    // 找到所有Level 2分类
    const level2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    console.log(`\nShanghai Oxford Level 2 categories (${level2Packs.length}):`);
    for (const pack of level2Packs) {
      console.log(`- ${pack.title} (ID: ${pack.id})`);

      // 检查每个Level 2下是否有Level 3
      const level3Packs = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, pack.id), eq(coursePack.level, 3)));

      if (level3Packs.length > 0) {
        console.log(`  └─ Has ${level3Packs.length} Level 3 units`);
      } else {
        // 检查是否直接有课程
        const directCourses = await db
          .select()
          .from(course)
          .where(eq(course.coursePackId, pack.id));
        console.log(`  └─ Has ${directCourses.length} direct courses (no Level 3)`);
      }
    }

    // 现在检查1600分类单词的结构
    console.log("\n" + "=".repeat(50));

    const words1600 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (words1600.length === 0) {
      console.log("No 1600分类单词 found");
      return;
    }

    const words1600Id = words1600[0].id;
    console.log(`Found 1600分类单词: ${words1600Id}`);

    const words1600Level2 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, words1600Id), eq(coursePack.level, 2)));

    console.log(`\n1600分类单词 Level 2 categories (${words1600Level2.length}):`);
    for (const pack of words1600Level2) {
      console.log(`- ${pack.title} (ID: ${pack.id})`);

      // 检查每个Level 2下是否有Level 3
      const level3Packs = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, pack.id), eq(coursePack.level, 3)));

      if (level3Packs.length > 0) {
        console.log(`  └─ Has ${level3Packs.length} Level 3 subcategories`);
      } else {
        // 检查是否直接有课程
        const directCourses = await db
          .select()
          .from(course)
          .where(eq(course.coursePackId, pack.id));
        console.log(`  └─ Has ${directCourses.length} direct courses (no Level 3)`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkShanghaiOxford();
}

module.exports = { checkShanghaiOxford };
