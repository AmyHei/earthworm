<template>
  <div class="course-pack-hierarchy">
    <!-- Breadcrumb Navigation -->
    <nav
      class="breadcrumb mb-6"
      v-if="breadcrumbs.length > 0"
    >
      <ol class="flex items-center space-x-2 text-sm">
        <li
          v-for="(breadcrumb, index) in breadcrumbs"
          :key="breadcrumb.id"
          class="flex items-center"
        >
          <button
            @click="navigateToBreadcrumb(breadcrumb)"
            :class="{
              'text-blue-600 hover:text-blue-800': index < breadcrumbs.length - 1,
              'cursor-default text-gray-500': index === breadcrumbs.length - 1,
            }"
          >
            {{ breadcrumb.title }}
          </button>
          <svg
            v-if="index < breadcrumbs.length - 1"
            class="mx-2 h-4 w-4 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </li>
      </ol>
    </nav>

    <!-- Level 1: 教材版本 (Textbooks) -->
    <div v-if="currentLevel === 1">
      <h2 class="mb-4 text-center text-3xl dark:border-gray-600">教材版本</h2>
      <div
        class="grid auto-rows-fr grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-0 md:grid-cols-3 lg:grid-cols-4"
      >
        <CoursePackCard
          v-for="textbook in textbooks"
          :key="textbook.id"
          :coursePack="{
            id: textbook.id,
            title: textbook.title,
            description: textbook.description,
            cover: textbook.cover,
            isFree: textbook.isFree,
          }"
          @cardClick="selectTextbook"
        />
      </div>
    </div>

    <!-- Level 2: 年级学期 (Grades) -->
    <div v-if="currentLevel === 2 && selectedTextbook && grades.length > 0">
      <h2 class="mb-4 text-center text-3xl dark:border-gray-600">
        {{ selectedTextbook.title }} - 年级学期
      </h2>
      <div
        class="grid auto-rows-fr grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-0 md:grid-cols-3 lg:grid-cols-4"
      >
        <CoursePackCard
          v-for="grade in grades"
          :key="grade.id"
          :coursePack="{
            id: grade.id,
            title: grade.title,
            description: grade.description,
            cover: grade.cover,
            isFree: grade.isFree,
          }"
          @cardClick="selectGrade"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { navigateTo } from "#app";
import { computed, ref } from "vue";

import {
  fetchCoursePacks,
  fetchGradeUnits,
  fetchHierarchicalStructure,
  fetchTextbookGrades,
} from "~/api/course-pack";
import { useNavigation } from "~/composables/useNavigation";
import CoursePackCard from "./CoursePackCard.vue";

interface CoursePack {
  id: string;
  title: string;
  description: string;
  cover: string;
  isFree: boolean;
  level: number;
}

const { gotoCourseList } = useNavigation();

// State management
const currentLevel = ref(1);
const selectedTextbook = ref<CoursePack | null>(null);
const selectedGrade = ref<CoursePack | null>(null);

const textbooks = ref<CoursePack[]>([]);
const grades = ref<CoursePack[]>([]);
const units = ref<CoursePack[]>([]);

// Breadcrumb navigation
const breadcrumbs = computed(() => {
  const crumbs = [];

  if (currentLevel.value >= 2 && selectedTextbook.value) {
    crumbs.push({
      id: selectedTextbook.value.id,
      title: selectedTextbook.value.title,
      level: 1,
    });
  }

  if (currentLevel.value >= 3 && selectedGrade.value) {
    crumbs.push({
      id: selectedGrade.value.id,
      title: selectedGrade.value.title,
      level: 2,
    });
  }

  return crumbs;
});

// Navigation functions
async function selectTextbook(textbook: CoursePack) {
  selectedTextbook.value = textbook;
  currentLevel.value = 2;

  try {
    grades.value = await fetchTextbookGrades(textbook.id);

    // If no grades found, this might be a direct course pack
    if (grades.value.length === 0) {
      console.log("No grades found, checking if textbook has direct courses...");

      // Try to get courses directly from this textbook
      try {
        const textbookData = await $fetch(`/api/course-pack/${textbook.id}`, {
          baseURL: "http://localhost:3001",
        });

        if (textbookData.courses && textbookData.courses.length > 0) {
          // Navigate directly to the first course
          const firstCourse = textbookData.courses[0];
          navigateTo(`/game/${textbook.id}/${firstCourse.id}`);
        } else {
          // Fallback to course list
          gotoCourseList(textbook.id);
        }
        return;
      } catch (error) {
        console.error("Failed to fetch textbook courses:", error);
        gotoCourseList(textbook.id);
        return;
      }
    }
  } catch (error) {
    console.error("Failed to fetch grades:", error);
  }
}

async function selectGrade(grade: CoursePack) {
  // Instead of fetching units (level 3), go directly to the course list
  if (grade.isFree) {
    try {
      // Fetch the grade's courses to get the first course
      const gradeData = await $fetch(`/api/course-pack/${grade.id}`, {
        baseURL: "http://localhost:3001",
      });

      if (gradeData.courses && gradeData.courses.length > 0) {
        // Navigate directly to the first course in the grade
        const firstCourse = gradeData.courses[0];
        navigateTo(`/game/${grade.id}/${firstCourse.id}`);
      } else {
        // Fallback to course list if no courses found
        gotoCourseList(grade.id);
      }
    } catch (error) {
      console.error("Failed to fetch grade courses:", error);
      // Fallback to course list on error
      gotoCourseList(grade.id);
    }
  } else {
    console.log("需要是会员");
  }
}

async function selectUnit(unit: CoursePack) {
  if (unit.isFree) {
    try {
      // Fetch the unit's courses to get the first course
      const unitData = await $fetch(`/api/course-pack/${unit.id}`, {
        baseURL: "http://localhost:3001",
      });

      if (unitData.courses && unitData.courses.length > 0) {
        // Navigate directly to the first course in the unit
        const firstCourse = unitData.courses[0];
        navigateTo(`/game/${unit.id}/${firstCourse.id}`);
      } else {
        // Fallback to course list if no courses found
        gotoCourseList(unit.id);
      }
    } catch (error) {
      console.error("Failed to fetch unit courses:", error);
      // Fallback to course list on error
      gotoCourseList(unit.id);
    }
  } else {
    console.log("需要是会员");
  }
}

function navigateToBreadcrumb(breadcrumb: any) {
  if (breadcrumb.level === 1) {
    currentLevel.value = 1;
    selectedTextbook.value = null;
    selectedGrade.value = null;
  } else if (breadcrumb.level === 2) {
    currentLevel.value = 2;
    selectedGrade.value = null;
  }
}

// Initialize data
async function loadTextbooks() {
  try {
    // For now, just show all course packs so user can see their courses
    const data = await fetchCoursePacks();
    console.log("Raw API response:", data);

    // Ensure data is an array
    if (Array.isArray(data)) {
      textbooks.value = data;
      console.log("Fetched all course packs:", data);
      console.log("Number of course packs:", data.length);

      // Debug: Show level values if they exist
      if (data.length > 0) {
        console.log("Sample course pack:", data[0]);
        const levelsFound = [...new Set(data.map((pack: any) => pack.level))].filter(
          (l) => l !== undefined,
        );
        console.log("Level values found:", levelsFound);
      }
    } else {
      console.error("API response is not an array:", data);
      textbooks.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch textbooks:", error);
    // Show error message to user
    textbooks.value = [];
  }
}

// Load initial data
loadTextbooks();
</script>

<style scoped>
.course-pack-hierarchy {
  @apply flex w-full flex-col;
}

.breadcrumb {
  @apply border-b border-gray-200 pb-4 dark:border-gray-600;
}

.breadcrumb button {
  @apply transition-colors duration-200;
}
</style>
