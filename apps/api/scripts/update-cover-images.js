const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { config } = require("dotenv");
const { eq } = require("drizzle-orm");

// Load environment variables
config({ path: "../../../.env" });

const { coursePack } = require("../../../packages/schema/dist/index.js");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5434/earthworm";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function updateCoverImages() {
  try {
    console.log("开始更新课程包封面图片...");

    // 更新1600分类单词的封面
    const words1600Result = await db
      .update(coursePack)
      .set({ cover: "/images/初中英语必背1600词汇.jpeg" })
      .where(eq(coursePack.title, "1600分类单词"));

    console.log("✅ 已更新 1600分类单词 的封面图片");

    // 验证更新结果
    const words1600 = await db
      .select()
      .from(coursePack)
      .where(eq(coursePack.title, "1600分类单词"));
    if (words1600.length > 0) {
      console.log(`1600分类单词: cover='${words1600[0].cover}'`);
    }

    // 确认上海牛津英语的封面是否正确
    const shanghaiOxford = await db
      .select()
      .from(coursePack)
      .where(eq(coursePack.title, "上海牛津英语-沪教版"));
    if (shanghaiOxford.length > 0) {
      console.log(`上海牛津英语-沪教版: cover='${shanghaiOxford[0].cover}'`);
    }

    console.log("\n封面图片更新完成！");
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  updateCoverImages()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { updateCoverImages };
