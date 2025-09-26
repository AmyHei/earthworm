<template>
  <div class="flex w-full flex-col">
    <template v-if="isLoading">
      <Loading></Loading>
    </template>
    <template v-else>
      <div class="h-[79vh] overflow-y-auto overflow-x-hidden scrollbar-hide">
        <CoursePackHierarchy />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import CoursePackHierarchy from "~/components/courses/CoursePackHierarchy.vue";

const isLoading = ref(false);
</script>

<style></style>
