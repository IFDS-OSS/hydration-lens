import { defineNuxtPlugin } from "#app";
import { init } from "hydration-lens-vue";

export default defineNuxtPlugin(() => {
  if (import.meta.dev) init(); // second guard, dead-code-eliminated in prod even if reached
});
