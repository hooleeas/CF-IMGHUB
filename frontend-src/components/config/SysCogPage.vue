import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.find.js";
import "core-js/modules/es.iterator.for-each.js";
import "core-js/modules/es.iterator.some.js";
import fetchWithAuth from '@/utils/fetchWithAuth';
import axios from '@/utils/axios';
import FloatingSaveButton from '@/components/FloatingSaveButton.vue';
export default {
  components: {
    FloatingSaveButton
  },
  data() {
    return {
      settings: {
        config: []
      },
      // 加载状态
      loading: true,
      // 可用渠道列表
      availableChannels: {}
    };
  },
  computed: {
    isEn() {
      return this.$i18n.locale === 'en';
    },
    // 根据category将配置项分组
    groupedSettings() {
      const grouped = {};
      if (this.settings.config) {
        this.settings.config.forEach(setting => {
          const category = this.isEn ? setting.category_en || setting.category || this.$t('sysPage.otherSettings') : setting.category || this.$t('sysPage.otherSettings');
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(setting);
        });
      }
      return grouped;
    },
    // 当前选择的上传渠道
    currentUploadChannel() {
      const channelSetting = this.settings.config?.find(s => s.id === 'defaultUploadChannel');
      return channelSetting?.value || '';
    },
    // 当前渠道类型对应的渠道列表
    currentChannelList() {
      return this.availableChannels[this.currentUploadChannel] || [];
    }
  },
  watch: {
    // 监听上传渠道变化，清空渠道名称（如果不在新列表中）
    currentUploadChannel(newVal, oldVal) {
      if (newVal !== oldVal) {
        const channelNameSetting = this.settings.config?.find(s => s.id === 'defaultChannelName');
        if (channelNameSetting) {
          const newChannelList = this.availableChannels[newVal] || [];
          if (!newChannelList.some(ch => ch.name === channelNameSetting.value)) {
            channelNameSetting.value = '';
          }
        }
      }
    }
  },
  methods: {
    localized(item, field) {
      if (this.isEn && item[field + '_en']) return item[field + '_en'];
      return item[field] || '';
    },
    localizedOption(option) {
      if (this.isEn && option.label_en) return option.label_en;
      return option.label;
    },
    saveSettings() {
      fetchWithAuth('/api/manage/sysConfig/page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.settings)
      }).then(() => this.$message.success(this.$t('sysPage.settingsSaved')));
    },
    // 获取可用渠道列表
    async fetchAvailableChannels() {
      try {
        const response = await axios.get('/api/channels');
        if (response.data) {
          this.availableChannels = response.data;
        }
      } catch (error) {
        console.error('Failed to fetch available channels:', error);
      }
    }
  },
  mounted() {
    this.loading = true;
    // 获取可用渠道列表
    this.fetchAvailableChannels();
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/page').then(response => response.json()).then(data => {
      this.settings = data;
      // 处理布尔类型的值初始化
      if (this.settings.config) {
        this.settings.config.forEach(setting => {
          if (setting.type === 'boolean') {
            // 将字符串转换为布尔值
            if (typeof setting.value === 'string') {
              setting.value = setting.value === 'true';
            } else if (setting.value === undefined || setting.value === null) {
              // 如果没有值，使用默认值
              setting.value = setting.default || false;
            }
          }
        });
      }
    }).finally(() => {
      this.loading = false;
    });
  }
};