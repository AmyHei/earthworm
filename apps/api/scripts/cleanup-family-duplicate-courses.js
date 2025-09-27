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

async function cleanupFamilyDuplicateCourses() {
  try {
    console.log('开始清理"家庭与人物称呼及职业职务"分类内的重复课程...');

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

    // 找到"家庭与人物称呼及职业职务"分类（使用之前找到的那个ID）
    const familyPack = await db
      .select()
      .from(coursePack)
      .where(eq(coursePack.id, "u59q4zyziy5mhwbw94b5wa8o"));

    if (familyPack.length === 0) {
      console.log("未找到家庭与人物称呼及职业职务分类");
      return;
    }

    const familyPackId = familyPack[0].id;
    console.log(`找到分类: ${familyPack[0].title} (ID: ${familyPackId})`);

    // 获取这个分类下的所有课程
    const courses = await db.select().from(course).where(eq(course.coursePackId, familyPackId));
    console.log(`\n找到${courses.length}门课程:`);

    // 特殊处理：直接合并两个"人物称呼词汇练习"课程
    const personCourses = courses.filter(
      (c) => c.title === "人物称呼词汇练习" || c.title === "⼈物称呼词汇练习",
    );

    if (personCourses.length === 2) {
      console.log('\n处理两个"人物称呼词汇练习"重复课程:');

      const courseWithStatements = [];
      for (const courseItem of personCourses) {
        const statements = await db
          .select()
          .from(statement)
          .where(eq(statement.courseId, courseItem.id));
        courseWithStatements.push({
          course: courseItem,
          statementCount: statements.length,
        });
        console.log(`- "${courseItem.title}" (ID: ${courseItem.id}): ${statements.length}个语句`);
      }

      // 保留语句多的，删除语句少的
      courseWithStatements.sort((a, b) => b.statementCount - a.statementCount);
      const courseToKeep = courseWithStatements[0];
      const courseToDelete = courseWithStatements[1];

      console.log(`保留: ${courseToKeep.course.title} (${courseToKeep.statementCount}个语句)`);
      console.log(`删除: ${courseToDelete.course.title} (${courseToDelete.statementCount}个语句)`);

      // 移动语句
      if (courseToDelete.statementCount > 0) {
        const statementsToMove = await db
          .select()
          .from(statement)
          .where(eq(statement.courseId, courseToDelete.course.id));

        for (const stmt of statementsToMove) {
          await db
            .update(statement)
            .set({ courseId: courseToKeep.course.id })
            .where(eq(statement.id, stmt.id));
        }

        console.log(`移动了${courseToDelete.statementCount}个语句`);
      }

      // 删除重复课程
      await db.delete(course).where(eq(course.id, courseToDelete.course.id));
      console.log("删除重复课程完成");
    }

    // 现在按课程标题分组剩余的课程
    const remainingCourses = await db
      .select()
      .from(course)
      .where(eq(course.coursePackId, familyPackId));
    const courseGroups = new Map();
    for (const courseItem of remainingCourses) {
      const title = courseItem.title;
      if (!courseGroups.has(title)) {
        courseGroups.set(title, []);
      }
      courseGroups.get(title).push(courseItem);
    }

    // 显示每门课程及其语句数量
    for (const [courseTitle, duplicateCourses] of courseGroups.entries()) {
      console.log(`\n课程: "${courseTitle}" (${duplicateCourses.length}个重复项)`);

      for (const courseItem of duplicateCourses) {
        const statements = await db
          .select()
          .from(statement)
          .where(eq(statement.courseId, courseItem.id));
        console.log(`  - ID: ${courseItem.id}, 语句数: ${statements.length}`);
      }

      // 如果有重复的课程，保留语句最多的，删除其他的
      if (duplicateCourses.length > 1) {
        // 获取每个课程的语句数量
        const coursesWithStatements = [];
        for (const courseItem of duplicateCourses) {
          const statements = await db
            .select()
            .from(statement)
            .where(eq(statement.courseId, courseItem.id));
          coursesWithStatements.push({
            course: courseItem,
            statementCount: statements.length,
          });
        }

        // 按语句数量排序，保留最多的
        coursesWithStatements.sort((a, b) => b.statementCount - a.statementCount);
        const courseToKeep = coursesWithStatements[0];
        const coursesToDelete = coursesWithStatements.slice(1);

        console.log(
          `    保留: ID ${courseToKeep.course.id} (${courseToKeep.statementCount}个语句)`,
        );

        for (const courseToDelete of coursesToDelete) {
          console.log(
            `    删除: ID ${courseToDelete.course.id} (${courseToDelete.statementCount}个语句)`,
          );

          // 将要删除课程的语句移动到保留的课程中
          if (courseToDelete.statementCount > 0) {
            const statementsToMove = await db
              .select()
              .from(statement)
              .where(eq(statement.courseId, courseToDelete.course.id));

            for (const stmt of statementsToMove) {
              await db
                .update(statement)
                .set({ courseId: courseToKeep.course.id })
                .where(eq(statement.id, stmt.id));
            }

            console.log(`      └─ 将${courseToDelete.statementCount}个语句移动到保留的课程中`);
          }

          // 删除课程
          await db.delete(course).where(eq(course.id, courseToDelete.course.id));
        }
      }
    }

    // 最终统计
    const finalCourses = await db
      .select()
      .from(course)
      .where(eq(course.coursePackId, familyPackId));
    console.log(`\n清理完成！最终有${finalCourses.length}门课程`);

    for (const courseItem of finalCourses) {
      const statements = await db
        .select()
        .from(statement)
        .where(eq(statement.courseId, courseItem.id));
      console.log(`- ${courseItem.title}: ${statements.length}个语句`);
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  cleanupFamilyDuplicateCourses()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { cleanupFamilyDuplicateCourses };
