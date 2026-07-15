<script setup lang="ts">
// Not wrapped in useState() — that would sync the value across the server/client
// boundary via the Nuxt payload and defeat the point of this demo.
const randomValue = Math.random().toString(36).slice(2);
</script>

<template>
  <main style="font-family: system-ui, sans-serif; padding: 32px">
    <h1>hydration-lens — Nuxt demo</h1>
    <p>
      The paragraph below is seeded to mismatch between server and client render (a
      <code>Math.random()</code> call directly in <code>&lt;script setup&gt;</code>, not synced via
      <code>useState</code>). Open the console for Vue's warning, and the hydration-lens badge in
      the bottom-right corner to see it caught and located.
    </p>
    <p id="mismatch">{{ randomValue }}</p>
  </main>
</template>
