<template>
  <main class="admin-settings-page">
    <div class="admin-settings-content">
      <SysCogUpload class="admin-section" />
      <SysCogPage class="admin-section" />
      <SysCogOthers class="admin-section" />
    </div>
  </main>
</template>

<script>
import SysCogUpload from '@/components/config/SysCogUpload.vue';
import SysCogPage from '@/components/config/SysCogPage.vue';
import SysCogOthers from '@/components/config/SysCogOthers.vue';

export default {
  name: 'SystemConfig',
  components: {
    SysCogUpload,
    SysCogPage,
    SysCogOthers,
  },
};
</script>
