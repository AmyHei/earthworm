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

async function mergeDuplicateFamilyCategory() {
  try {
    console.log('开始合并重复的"家庭与人物称呼及职业职务"分类...');

    // 找到"1600分类单词"主课程包
    const mainPack = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    if (mainPack.length === 0) {
      console.log("未找到1600分类单词主课程包");
      return;
    }

    const mainPackId = mainPack[0].id;

    // 找到所有包含"家庭"和"人物称呼"和"职业职务"的分类
    const allLevel2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    // 打印所有分类标题以便调试
    console.log("\n所有Level 2分类:");
    allLevel2Packs.forEach((pack) => {
      console.log(`- "${pack.title}" (ID: ${pack.id})`);
    });

    // 特定匹配这两个重复的分类ID
    const duplicatePackIds = ["u59q4zyziy5mhwbw94b5wa8o", "ieqw0d8mhzdkjt5xha0o8h7a"];
    const duplicatePacks = allLevel2Packs.filter((pack) => duplicatePackIds.includes(pack.id));

    console.log(`\n找到${duplicatePacks.length}个匹配"家庭与人物称呼及职业职务"的分类:`);
    duplicatePacks.forEach((pack) => {
      console.log(`- "${pack.title}" (ID: ${pack.id})`);
    });

    if (duplicatePacks.length <= 1) {
      console.log("没有重复的分类需要合并");
      return;
    }

    // 保留第一个，合并其他的
    const packToKeep = duplicatePacks[0];
    const packsToMerge = duplicatePacks.slice(1);

    console.log(`保留分类ID: ${packToKeep.id}`);
    console.log(`需要合并的分类: ${packsToMerge.map((p) => p.id).join(", ")}`);

    let totalMergedCourses = 0;

    // 合并每个重复分类的课程
    for (const packToMerge of packsToMerge) {
      console.log(`\n处理分类ID: ${packToMerge.id}`);

      // 获取这个分类下的所有课程
      const coursesToMove = await db
        .select()
        .from(course)
        .where(eq(course.coursePackId, packToMerge.id));

      console.log(`  找到${coursesToMove.length}门课程需要移动`);

      // 将所有课程移动到保留的分类中
      for (const courseItem of coursesToMove) {
        await db
          .update(course)
          .set({ coursePackId: packToKeep.id })
          .where(eq(course.id, courseItem.id));

        console.log(`    └─ 移动课程: "${courseItem.title}"`);
        totalMergedCourses++;
      }

      // 删除空的重复分类
      await db.delete(coursePack).where(eq(coursePack.id, packToMerge.id));
      console.log(`  删除空分类: ${packToMerge.id}`);
    }

    // 统计最终结果
    const finalCourses = await db
      .select()
      .from(course)
      .where(eq(course.coursePackId, packToKeep.id));
    console.log(`\n合并完成！`);
    console.log(`- 合并了${totalMergedCourses}门课程`);
    console.log(`- 删除了${packsToMerge.length}个重复分类`);
    console.log(`- "家庭与人物称呼及职业职务"分类最终有${finalCourses.length}门课程`);

    // 验证结果 - 确保只剩一个"家庭与人物称呼及职业职务"分类
    const remainingDuplicates = await db
      .select()
      .from(coursePack)
      .where(
        and(
          eq(coursePack.parentId, mainPackId),
          eq(coursePack.level, 2),
          eq(coursePack.title, "家庭与人物称呼及职业职务"),
        ),
      );

    console.log(
      `\n验证结果: 现在有${remainingDuplicates.length}个"家庭与人物称呼及职业职务"分类 (应该为1)`,
    );
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  mergeDuplicateFamilyCategory()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { mergeDuplicateFamilyCategory };
