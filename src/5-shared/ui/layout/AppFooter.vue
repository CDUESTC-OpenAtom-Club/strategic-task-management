<script setup lang="ts">
const ICP_NUMBER = import.meta.env.VITE_ICP_NUMBER || '蜀ICP备2025177084号'
const ICP_LINK = import.meta.env.VITE_ICP_LINK || 'https://beian.miit.gov.cn/'
</script>

<template>
  <footer class="app-footer">
    <a :href="ICP_LINK" target="_blank" rel="noopener noreferrer" class="icp-link">
      {{ ICP_NUMBER }}
    </a>
  </footer>
</template>

<style scoped>
.app-footer {
  text-align: center;
  padding: 16px 0 12px;
  margin-top: auto;
}

.icp-link {
  color: var(--text-light, #94a3b8);
  font-size: 12px;
  text-decoration: none;
  transition: color 0.2s;
}

.icp-link:hover {
  color: var(--primary, #2c5282);
}
</style>
