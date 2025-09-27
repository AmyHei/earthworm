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

async function cleanupDuplicateCourses() {
  try {
    console.log("开始清理重复课程...");

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

    // 获取所有Level 2分类
    const level2Packs = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.parentId, mainPackId), eq(coursePack.level, 2)));

    console.log(`找到${level2Packs.length}个Level 2分类`);

    let totalRemovedCourses = 0;
    let totalRemovedStatements = 0;

    // 处理每个分类
    for (const pack of level2Packs) {
      console.log(`\n检查分类: ${pack.title} (ID: ${pack.id})`);

      // 获取这个分类下的所有课程
      const courses = await db.select().from(course).where(eq(course.coursePackId, pack.id));

      if (courses.length === 0) {
        console.log("  没有课程");
        continue;
      }

      // 按课程标题分组
      const courseGroups = new Map();
      for (const courseItem of courses) {
        const title = courseItem.title;
        if (!courseGroups.has(title)) {
          courseGroups.set(title, []);
        }
        courseGroups.get(title).push(courseItem);
      }

      console.log(`  找到${courses.length}门课程，${courseGroups.size}个不同标题`);

      // 处理重复课程
      for (const [courseTitle, duplicateCourses] of courseGroups.entries()) {
        if (duplicateCourses.length > 1) {
          console.log(`    "${courseTitle}" 有${duplicateCourses.length}个重复项`);

          // 保留第一个课程，合并其他课程的语句到第一个课程中
          const courseToKeep = duplicateCourses[0];
          const coursesToDelete = duplicateCourses.slice(1);

          for (const courseToDelete of coursesToDelete) {
            // 获取要删除课程的所有语句
            const statementsToMove = await db
              .select()
              .from(statement)
              .where(eq(statement.courseId, courseToDelete.id));

            // 将语句移动到保留的课程中
            for (const stmt of statementsToMove) {
              await db
                .update(statement)
                .set({ courseId: courseToKeep.id })
                .where(eq(statement.id, stmt.id));
            }

            console.log(`      └─ 将${statementsToMove.length}个语句从重复课程移动到主课程`);
            totalRemovedStatements += statementsToMove.length;

            // 删除重复的课程
            await db.delete(course).where(eq(course.id, courseToDelete.id));
            totalRemovedCourses++;
          }

          // 统计最终语句数量
          const finalStatements = await db
            .select()
            .from(statement)
            .where(eq(statement.courseId, courseToKeep.id));
          console.log(`      最终保留课程有${finalStatements.length}个语句`);
        }
      }

      // 统计最终课程数量
      const finalCourses = await db.select().from(course).where(eq(course.coursePackId, pack.id));
      console.log(`  最终有${finalCourses.length}门课程`);
    }

    console.log(`\n清理完成！`);
    console.log(`- 删除了${totalRemovedCourses}门重复课程`);
    console.log(`- 移动了${totalRemovedStatements}个语句`);

    // 最终统计
    const finalCourseCount = await db.select().from(course);
    const finalStatementCount = await db.select().from(statement);
    console.log(`\n最终统计:`);
    console.log(`- 总课程数: ${finalCourseCount.length}`);
    console.log(`- 总语句数: ${finalStatementCount.length}`);
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  cleanupDuplicateCourses()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { cleanupDuplicateCourses };
