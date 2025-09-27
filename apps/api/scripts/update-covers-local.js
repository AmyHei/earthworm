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

async function updateCoversLocal() {
  try {
    console.log("设置本地开发环境的封面图片...");

    // 使用空字符串，让前端显示默认样式，与其他课程包大小一致
    const defaultCover = "";

    // 更新1600分类单词主课程包
    await db
      .update(coursePack)
      .set({ cover: defaultCover })
      .where(eq(coursePack.title, "1600分类单词"));

    console.log("✅ 已更新 1600分类单词 主课程包封面");

    // 更新上海牛津英语主课程包
    await db
      .update(coursePack)
      .set({ cover: defaultCover })
      .where(eq(coursePack.title, "上海牛津英语-沪教版"));

    console.log("✅ 已更新 上海牛津英语 主课程包封面");

    // 更新所有Level 2分类
    const words1600 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (words1600.length > 0) {
      const words1600Level2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, words1600[0].id), eq(coursePack.level, 2)));

      for (const pack of words1600Level2) {
        await db.update(coursePack).set({ cover: defaultCover }).where(eq(coursePack.id, pack.id));
      }

      console.log(`✅ 已更新 ${words1600Level2.length} 个1600分类单词Level 2分类封面`);
    }

    const shanghaiOxford = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "上海牛津英语-沪教版"), eq(coursePack.level, 1)));

    if (shanghaiOxford.length > 0) {
      const shanghaiLevel2 = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, shanghaiOxford[0].id), eq(coursePack.level, 2)));

      for (const pack of shanghaiLevel2) {
        await db.update(coursePack).set({ cover: defaultCover }).where(eq(coursePack.id, pack.id));
      }

      console.log(`✅ 已更新 ${shanghaiLevel2.length} 个上海牛津英语Level 2分类封面`);
    }

    console.log("\n本地开发环境封面设置完成！");
    console.log("现在所有课程包都使用前端默认样式，大小与其他课程包保持一致");
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  updateCoversLocal()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { updateCoversLocal };
