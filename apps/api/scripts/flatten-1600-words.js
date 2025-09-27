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

async function flatten1600Words() {
  try {
    console.log("开始重组1600分类单词为2级结构...");

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
    console.log(`找到主课程包: ${mainPackId}`);

    // 获取所有Level 2分类
    const level2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    console.log(`找到${level2Packs.length}个Level 2分类`);

    // 按分类名称分组，找出重复项
    const categoryGroups = new Map();
    for (const pack of level2Packs) {
      const categoryName = pack.title;
      if (!categoryGroups.has(categoryName)) {
        categoryGroups.set(categoryName, []);
      }
      categoryGroups.get(categoryName).push(pack);
    }

    console.log(`实际有${categoryGroups.size}个不同的分类`);

    // 处理每个分类组
    for (const [categoryName, packs] of categoryGroups.entries()) {
      console.log(`\n处理分类: ${categoryName} (${packs.length}个重复项)`);

      // 保留第一个，删除其他重复项
      const packToKeep = packs[0];
      const packsToDelete = packs.slice(1);

      // 收集所有需要合并的课程
      const allCourses = [];
      const allCoursesToDelete = [];

      // 获取保留包的所有Level 3子分类和课程
      const level3Packs = await db
        .select()
        .from(coursePack)
        .where(and(eq(coursePack.parentId, packToKeep.id), eq(coursePack.level, 3)));

      // 将Level 3的课程合并到Level 2
      for (const level3Pack of level3Packs) {
        const level3Courses = await db
          .select()
          .from(course)
          .where(eq(course.coursePackId, level3Pack.id));

        for (const courseItem of level3Courses) {
          // 更新课程的归属到Level 2
          await db
            .update(course)
            .set({ coursePackId: packToKeep.id })
            .where(eq(course.id, courseItem.id));

          console.log(`  └─ 将课程 "${courseItem.title}" 从Level 3移动到Level 2`);
        }

        allCoursesToDelete.push(level3Pack.id);
      }

      // 处理重复的Level 2包
      for (const packToDelete of packsToDelete) {
        console.log(`  删除重复的Level 2包: ${packToDelete.id}`);

        // 获取这个重复包的Level 3子分类
        const duplicateLevel3Packs = await db
          .select()
          .from(coursePack)
          .where(and(eq(coursePack.parentId, packToDelete.id), eq(coursePack.level, 3)));

        // 将重复包的Level 3课程也合并到保留的Level 2包
        for (const level3Pack of duplicateLevel3Packs) {
          const level3Courses = await db
            .select()
            .from(course)
            .where(eq(course.coursePackId, level3Pack.id));

          for (const courseItem of level3Courses) {
            // 更新课程的归属到保留的Level 2包
            await db
              .update(course)
              .set({ coursePackId: packToKeep.id })
              .where(eq(course.id, courseItem.id));

            console.log(`  └─ 将课程 "${courseItem.title}" 从重复Level 3移动到保留的Level 2`);
          }

          allCoursesToDelete.push(level3Pack.id);
        }

        // 删除重复的Level 2包
        await db.delete(coursePack).where(eq(coursePack.id, packToDelete.id));
      }

      // 删除所有Level 3包（现在课程已经移动到Level 2了）
      if (allCoursesToDelete.length > 0) {
        await db.delete(coursePack).where(inArray(coursePack.id, allCoursesToDelete));
        console.log(`  删除了${allCoursesToDelete.length}个Level 3包`);
      }

      // 统计最终结果
      const finalCourses = await db
        .select()
        .from(course)
        .where(eq(course.coursePackId, packToKeep.id));
      console.log(`  最终 "${categoryName}" 有${finalCourses.length}门课程`);
    }

    console.log("\n重组完成！");

    // 验证结果
    const finalLevel2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    const finalLevel3Packs = await db.select().from(coursePack).where(eq(coursePack.level, 3));
    const level3Count = finalLevel3Packs.filter((p) => {
      // 检查是否属于1600分类单词系统
      return finalLevel2Packs.some((l2) => l2.id === p.parentId);
    }).length;

    console.log(`\n最终结果:`);
    console.log(`- Level 2分类: ${finalLevel2Packs.length}个`);
    console.log(`- 1600分类单词的Level 3包: ${level3Count}个 (应该为0)`);

    for (const pack of finalLevel2Packs) {
      const courses = await db.select().from(course).where(eq(course.coursePackId, pack.id));
      console.log(`  - ${pack.title}: ${courses.length}门课程`);
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  flatten1600Words()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { flatten1600Words };
