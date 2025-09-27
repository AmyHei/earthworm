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

async function updateLevel2Covers() {
  try {
    console.log("开始更新Level 2课程包封面...");

    // 找到上海牛津英语主课程包
    const shanghaiOxford = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "上海牛津英语-沪教版"), eq(coursePack.level, 1)));

    if (shanghaiOxford.length > 0) {
      // 更新上海牛津英语的所有Level 2分类封面
      const shanghaiLevel2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, shanghaiOxford[0].id), eq(coursePack.level, 2)));

      console.log(`更新上海牛津英语的${shanghaiLevel2.length}个Level 2分类封面...`);

      for (const pack of shanghaiLevel2) {
        await db
          .update(coursePack)
          .set({ cover: "/images/shanghaiOxford.jpg" })
          .where(eq(coursePack.id, pack.id));

        console.log(`✅ ${pack.title}: 已设置封面`);
      }
    }

    // 找到1600分类单词主课程包
    const words1600 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (words1600.length > 0) {
      // 更新1600分类单词的所有Level 2分类封面
      const words1600Level2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, words1600[0].id), eq(coursePack.level, 2)));

      console.log(`更新1600分类单词的${words1600Level2.length}个Level 2分类封面...`);

      for (const pack of words1600Level2) {
        await db
          .update(coursePack)
          .set({ cover: "/images/初中英语必背1600词汇.jpeg" })
          .where(eq(coursePack.id, pack.id));

        console.log(`✅ ${pack.title}: 已设置封面`);
      }
    }

    console.log("\nLevel 2封面更新完成！");
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  updateLevel2Covers()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { updateLevel2Covers };
