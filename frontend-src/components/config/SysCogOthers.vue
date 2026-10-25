import fetchWithAuth from '@/utils/fetchWithAuth';
import notifyToast from '@/utils/notifyToast';
import FloatingSaveButton from '@/components/FloatingSaveButton.vue';
export default {
  components: {
    FloatingSaveButton
  },
  data() {
    return {
      settings: {
        cloudflareApiToken: {},
        webDAV: {},
      },
      availableChannels: {},
      // 可用渠道列表
      // 加载状态
      loading: true
    };
  },
  computed: {
    // WebDAV 当前渠道类型对应的渠道列表
    webdavChannelList() {
      const channelType = this.settings.webDAV?.uploadChannel;
      return channelType ? this.availableChannels[channelType] || [] : [];
    }
  },
  watch: {
    'settings.webDAV.uploadChannel'() {
      // 切换渠道类型时清空指定的渠道名称
      if (this.settings.webDAV) {
        this.settings.webDAV.channelName = '';
      }
    }
  },
  methods: {
    async saveSettings() {
      try {
        const response = await fetchWithAuth('/api/manage/sysConfig/others', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.settings)
        });
        if (!response.ok) throw new Error(`Settings save failed (${response.status})`);
        notifyToast(this.$t('sysOthers.settingsSaved'));
      } catch (error) {
        console.error('Failed to save other settings:', error);
        notifyToast(error.message || '保存其他设置失败，请稍后重试。', 'error');
      }
    },
    async fetchAvailableChannels() {
      try {
        const response = await fetchWithAuth('/api/channels');
        if (response.ok) {
          this.availableChannels = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch available channels:', error);
      }
    }
  },
  mounted() {
    this.loading = true;
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/others').then(response => response.json()).then(data => {
      this.settings = data;
    }).finally(() => {
      this.loading = false;
    });
    // 获取可用渠道列表
    this.fetchAvailableChannels();
  }
};
