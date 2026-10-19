import fetchWithAuth from '@/utils/fetchWithAuth';
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
    saveSettings() {
      fetchWithAuth('/api/manage/sysConfig/others', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.settings)
      }).then(() => this.$message.success(this.$t('sysOthers.settingsSaved')));
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
