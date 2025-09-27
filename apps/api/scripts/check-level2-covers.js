const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { config } = require("dotenv");
const { eq, and } = require("drizzle-orm");

// Load environment variables
config({ path: "../../../.env" });

const { coursePack } = require("../../../packages/schema/dist/index.js");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5434/earthworm";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function checkLevel2Covers() {
  try {
    console.log("检查Level 2课程包的封面...");

    // 检查上海牛津英语的Level 2分类
    const shanghaiOxford = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "上海牛津英语-沪教版"), eq(coursePack.level, 1)));

    if (shanghaiOxford.length > 0) {
      const shanghaiLevel2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, shanghaiOxford[0].id), eq(coursePack.level, 2)));

      console.log(`\n上海牛津英语 Level 2分类 (${shanghaiLevel2.length}个):`);
      shanghaiLevel2.slice(0, 3).forEach((pack) => {
        console.log(`- ${pack.title}: cover='${pack.cover || "(null)"}'`);
      });
    }

    // 检查1600分类单词的Level 2分类
    const words1600 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (words1600.length > 0) {
      const words1600Level2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, words1600[0].id), eq(coursePack.level, 2)));

      console.log(`\n1600分类单词 Level 2分类 (${words1600Level2.length}个):`);
      words1600Level2.slice(0, 5).forEach((pack) => {
        console.log(`- ${pack.title}: cover='${pack.cover || "(null)"}'`);
      });
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkLevel2Covers();
}

module.exports = { checkLevel2Covers };
