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

async function checkCoverFields() {
  try {
    console.log("检查课程包的cover字段...");

    // 查看所有Level 1课程包的cover字段
    const level1Packs = await db.select().from(coursePack).where(eq(coursePack.level, 1));

    console.log("\nLevel 1 课程包:");
    level1Packs.forEach((pack) => {
      console.log(`- ${pack.title}: cover='${pack.cover || "(null)"}'`);
    });

    // 特别检查上海牛津英语和1600分类单词
    console.log("\n=== 主要课程包详情 ===");

    const shanghaiOxford = level1Packs.find((p) => p.title === "上海牛津英语-沪教版");
    if (shanghaiOxford) {
      console.log(
        `上海牛津英语-沪教版: ID=${shanghaiOxford.id}, cover='${shanghaiOxford.cover || "(null)"}'`,
      );
    }

    const words1600 = level1Packs.find((p) => p.title === "1600分类单词");
    if (words1600) {
      console.log(`1600分类单词: ID=${words1600.id}, cover='${words1600.cover || "(null)"}'`);
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkCoverFields();
}

module.exports = { checkCoverFields };
