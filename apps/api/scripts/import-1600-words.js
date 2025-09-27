const { MongoClient } = require("mongodb");
const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { createId } = require("@paralleldrive/cuid2");
const { config } = require("dotenv");
const { eq, and } = require("drizzle-orm");

// Load environment variables
config({ path: "../../../.env" });

// Import schemas - using the compiled version
const { coursePack, course, statement } = require("../../../packages/schema/dist/index.js");

// MongoDB connection - using vocabulary_db database
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vocabulary_db";

// PostgreSQL connection - using the same port as in .env
const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5434/earthworm";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

// Phonetic API service function
async function getPhonetic(word) {
  try {
    // You can replace this with your preferred phonetic API
    // For now, using a mock response or you can integrate with a real API
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (response.ok) {
      const data = await response.json();
      if (data[0] && data[0].phonetics && data[0].phonetics[0]) {
        return data[0].phonetics[0].text || "";
      }
    }
    return "";
  } catch (error) {
    console.log(`Failed to get phonetic for ${word}:`, error.message);
    return "";
  }
}

async function importCategorizedWords() {
  let mongoClient;

  try {
    console.log(`Connecting to MongoDB at: ${MONGO_URI}...`);
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("Connected to MongoDB successfully!");

    const mongoDb = mongoClient.db("vocabulary_db");
    const collection = mongoDb.collection("categorized_words_1600");

    console.log("Fetching categorized words...");
    const words = await collection.find({}).toArray();
    console.log(`Found ${words.length} words to import`);

    // Exit early if no words found
    if (words.length === 0) {
      console.log(
        "No words found in the categorized_words_1600 collection. Please check your MongoDB data.",
      );
      return;
    }

    // Group by category and subcategory
    const categoryMap = new Map();
    const subcategoryMap = new Map();

    words.forEach((word) => {
      const { category, subcategory } = word;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Set());
      }
      categoryMap.get(category).add(subcategory);

      const subcategoryKey = `${category}::${subcategory}`;
      if (!subcategoryMap.has(subcategoryKey)) {
        subcategoryMap.set(subcategoryKey, []);
      }
      subcategoryMap.get(subcategoryKey).push(word);
    });

    console.log(`Found ${categoryMap.size} categories and ${subcategoryMap.size} subcategories`);

    // Check if Level 1 course pack already exists
    console.log("Checking for existing Level 1 course pack: 1600分类单词...");
    const existingLevel1 = await db
      .select()
      .from(coursePack)
      .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));

    let level1Id;
    if (existingLevel1.length > 0) {
      console.log(`Found existing Level 1 course pack: ${existingLevel1[0].id}`);
      level1Id = existingLevel1[0].id;

      // If there are duplicates, clean them up first
      if (existingLevel1.length > 1) {
        console.log(
          `Found ${existingLevel1.length} duplicate Level 1 course packs, cleaning up...`,
        );
        const { cleanupDuplicates } = require("./cleanup-duplicates.js");
        await cleanupDuplicates();

        // Get the remaining one
        const remainingLevel1 = await db
          .select()
          .from(coursePack)
          .where(and(eq(coursePack.title, "1600分类单词"), eq(coursePack.level, 1)));
        level1Id = remainingLevel1[0].id;
      }
    } else {
      // Create Level 1: Main textbook
      console.log("Creating Level 1 course pack: 1600分类单词...");
      level1Id = createId();
      await db.insert(coursePack).values({
        id: level1Id,
        order: 10,
        title: "1600分类单词",
        description: "1600个分类单词，按主题和场景分类学习",
        isFree: true,
        shareLevel: "public",
        level: 1,
        creatorId: "system",
      });
    }

    let categoryOrder = 1;
    const categoryIds = new Map();

    // Create Level 2: Categories
    console.log("Creating Level 2 course packs for categories...");
    for (const [category, subcategories] of categoryMap.entries()) {
      const categoryId = createId();
      categoryIds.set(category, categoryId);

      await db.insert(coursePack).values({
        id: categoryId,
        order: categoryOrder++,
        title: category,
        description: `${category}相关词汇，包含${subcategories.size}个子分类`,
        isFree: true,
        shareLevel: "public",
        level: 2,
        parentId: level1Id,
        creatorId: "system",
      });

      console.log(`Created category: ${category}`);
    }

    let subcategoryOrder = 1;
    const subcategoryIds = new Map();

    // Create Level 3: Subcategories
    console.log("Creating Level 3 course packs for subcategories...");
    for (const [subcategoryKey, wordsInSubcategory] of subcategoryMap.entries()) {
      const [category, subcategory] = subcategoryKey.split("::");
      const subcategoryId = createId();
      subcategoryIds.set(subcategoryKey, subcategoryId);

      await db.insert(coursePack).values({
        id: subcategoryId,
        order: subcategoryOrder++,
        title: subcategory,
        description: `${subcategory}词汇，包含${wordsInSubcategory.length}个单词`,
        isFree: true,
        shareLevel: "public",
        level: 3,
        parentId: categoryIds.get(category),
        creatorId: "system",
      });

      console.log(`Created subcategory: ${category} -> ${subcategory}`);
    }

    // Create courses and statements for each subcategory
    console.log("Creating courses and statements...");
    let courseOrder = 1;

    for (const [subcategoryKey, wordsInSubcategory] of subcategoryMap.entries()) {
      const [category, subcategory] = subcategoryKey.split("::");
      const subcategoryId = subcategoryIds.get(subcategoryKey);

      // Create a course for this subcategory
      const courseId = createId();
      await db.insert(course).values({
        id: courseId,
        order: courseOrder++,
        title: `${subcategory}词汇练习`,
        description: `学习${subcategory}相关的英语词汇`,
        coursePackId: subcategoryId,
      });

      console.log(
        `Creating course for: ${category} -> ${subcategory} (${wordsInSubcategory.length} words)`,
      );

      // Create statements for each word
      let statementOrder = 1;
      for (const word of wordsInSubcategory) {
        let phonetic = word.phonetic || "";

        // Get phonetic if not available
        if (!phonetic && word.english) {
          console.log(`Getting phonetic for: ${word.english}`);
          phonetic = await getPhonetic(word.english);
          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await db.insert(statement).values({
          id: createId(),
          order: statementOrder++,
          english: word.english || "",
          chinese: word.chinese || "",
          soundmark: phonetic,
          courseId: courseId,
        });
      }

      console.log(`Created ${wordsInSubcategory.length} statements for ${subcategory}`);
    }

    console.log("Import completed successfully!");
    console.log(`Created:`);
    console.log(`- 1 Level 1 course pack (1600分类单词)`);
    console.log(`- ${categoryMap.size} Level 2 course packs (categories)`);
    console.log(`- ${subcategoryMap.size} Level 3 course packs (subcategories)`);
    console.log(`- ${subcategoryMap.size} courses`);
    console.log(`- ${words.length} statements`);
  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
    await sql.end();
  }
}

// Run the import
if (require.main === module) {
  importCategorizedWords()
    .then(() => {
      console.log("Import script finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import script failed:", error);
      process.exit(1);
    });
}

module.exports = { importCategorizedWords };
