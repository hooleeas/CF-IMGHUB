import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.some.js";
import UploadForm from '@/components/upload/UploadForm.vue';
import { setLocale } from '@/locales';
import UploadSettingsDialog from '@/components/upload/UploadSettingsDialog.vue';
import backgroundManager from '@/mixins/backgroundManager';
import axios from '@/utils/axios';
import notifyToast from '@/utils/notifyToast';
import { ref } from 'vue';
import { mapGetters } from 'vuex';
export default {
  name: 'UploadHome',
  mixins: [backgroundManager],
  data() {
    return {
      selectedUrlForm: ref(''),
      showUrlDialog: false,
      showCompressDialog: false,
      customerCompress: true,
      //上传前压缩
      compressQuality: 4,
      //压缩后大小
      compressBar: 5,
      //压缩阈值
      convertToWebp: false,
      //转换为WebP格式
      serverCompress: true,
      //服务器端压缩
      uploadChannel: '',
      //上传渠道
      channelName: '',
      //指定的渠道名称
      availableChannels: {},
      //可用渠道列表
      uploadNameType: '',
      //上传文件命名方式
      customUrlPrefix: '',
      //自定义链接前缀
      useCustomUrl: 'false',
      //是否启用自定义链接格式
      autoRetry: true,
      //失败自动切换
      useDefaultWallPaper: false,
      uploadMethod: 'default',
      showAnnouncementDialog: false,
      // 控制公告弹窗的显示
      announcementContent: ''
    };
  },
  watch: {
    customerCompress(val) {
      this.updateCompressConfig('customerCompress', val);
    },
    compressQuality(val) {
      this.updateCompressConfig('compressQuality', val);
    },
    compressBar(val) {
      // 确保值在有效范围内
      if (val === null || val === undefined || val < 1) {
        this.compressBar = 1;
        return;
      }
      // 确保期望大小不超过压缩阈值
      if (this.compressQuality > val) {
        this.compressQuality = val;
      }
      this.updateCompressConfig('compressBar', val);
    },
    serverCompress(val) {
      this.updateCompressConfig('serverCompress', val);
    },
    convertToWebp(val) {
      this.updateCompressConfig('convertToWebp', val);
    },
    uploadChannel(val) {
      this.updateStoreUploadChannel(val);
      if (!this.currentChannelList.some(channel => channel.name === this.channelName)) {
        this.channelName = '';
      }
    },
    channelName(val) {
      // 确保清空时保存空字符串而不是null
      this.$store.commit('setStoreChannelName', val || '');
    },
    uploadNameType(val) {
      this.updateStoreUploadNameType(val);
    },
    customUrlPrefix(val) {
      this.$store.commit('setCustomUrlSettings', {
        key: 'customUrlPrefix',
        value: val
      });
    },
    useCustomUrl(val) {
      this.$store.commit('setCustomUrlSettings', {
        key: 'useCustomUrl',
        value: val
      });
    },
    autoRetry(val) {
      this.$store.commit('setStoreAutoRetry', val);
    },
  },
  computed: {
    ...mapGetters(['userConfig', 'uploadCopyUrlForm', 'compressConfig', 'storeUploadChannel', 'storeChannelName', 'storeUploadNameType', 'customUrlSettings', 'storeAutoRetry', 'storeUploadMethod']),
    dialogWidth() {
      return window.innerWidth > 768 ? '50%' : '90%';
    },
    disableTooltip() {
      return window.innerWidth < 768;
    },
    urlPrefix() {
      // 链接域名来自当前站点，文件路由后缀固定为 /file/。
      return `${window.location.origin}/file/`;
    },
    announcementAvailable() {
      return !!this.userConfig?.announcement;
    },
    // 当前渠道类型对应的渠道列表
    currentChannelList() {
      return this.availableChannels[this.uploadChannel] || [];
    }
  },
  mounted() {
    // 初始化背景图，启用自动创建元素
    this.initializeBackground('uploadBkImg', '.container', false, true);

    // 读取用户选择的链接格式
    this.selectedUrlForm = this.uploadCopyUrlForm || 'url';
    // 读取用户选择的压缩设置（优先用户设置，其次系统默认配置）
    this.customerCompress = this.compressConfig.customerCompress ?? this.parseBoolean(this.userConfig?.defaultCustomerCompress, true);
    this.compressQuality = this.compressConfig.compressQuality ?? this.parseNumber(this.userConfig?.defaultCompressQuality, 4);
    this.compressBar = this.compressConfig.compressBar ?? this.parseNumber(this.userConfig?.defaultCompressBar, 5);
    this.serverCompress = this.compressConfig.serverCompress ?? true;
    this.convertToWebp = this.compressConfig.convertToWebp ?? this.parseBoolean(this.userConfig?.defaultConvertToWebp, false);
    // Only use the administrator-configured channel ID as a default.
    this.uploadChannel = '';
    this.channelName = '';
    // 用户定义的失败自动切换
    this.autoRetry = this.storeAutoRetry;
    // 读取用户选择的上传文件命名方式
    this.uploadNameType = this.storeUploadNameType || this.userConfig?.defaultUploadNameType || 'default';
    // 读取用户自定义链接格式
    this.customUrlPrefix = this.customUrlSettings.customUrlPrefix;
    this.useCustomUrl = this.customUrlSettings.useCustomUrl;
    // 读取用户偏好的上传方式
    this.uploadMethod = this.storeUploadMethod;
    // 获取可用渠道列表
    this.fetchAvailableChannels();
    // 首次访问公告
    const visited = localStorage.getItem('visitedUploadHome');
    const announcement = this.userConfig?.announcement;
    if (!visited && announcement) {
      this.announcementContent = announcement;
      this.showAnnouncementDialog = true;
      localStorage.setItem('visitedUploadHome', 'true');
    }
  },
  components: {
    UploadForm,
    UploadSettingsDialog
  },
  methods: {
    // 获取可用渠道列表
    async fetchAvailableChannels() {
      try {
        const response = await axios.get('/api/channels', {
          withAuthCode: true
        });
        if (response.data) {
          this.availableChannels = response.data;
          const defaultChannelId = this.userConfig?.defaultChannelId;
          if (defaultChannelId) {
            const match = Object.entries(this.availableChannels)
              .flatMap(([type, channels]) => channels.map(channel => ({ ...channel, type })))
              .find(channel => channel.id === defaultChannelId);
            if (match) {
              this.uploadChannel = match.type;
              this.channelName = match.name;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch available channels:', error);
      }
    },
    handleManage() {
      this.$router.push('/admin');
    },
    // 解析布尔值
    parseBoolean(value, defaultValue) {
      if (value === undefined || value === null) return defaultValue;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      return defaultValue;
    },
    // 解析数字
    parseNumber(value, defaultValue) {
      if (value === undefined || value === null) return defaultValue;
      const num = parseFloat(value);
      return isNaN(num) ? defaultValue : num;
    },
    openUrlDialog() {
      this.showUrlDialog = true;
    },
    changeUrlForm() {
      this.$store.commit('setUploadCopyUrlForm', this.selectedUrlForm);
    },
    openCompressDialog() {
      this.showCompressDialog = true;
    },
    updateCompressConfig(key, value) {
      this.$store.commit('setCompressConfig', {
        key,
        value
      });
    },
    updateStoreUploadChannel(value) {
      this.$store.commit('setStoreUploadChannel', value);
    },
    updateStoreUploadNameType(value) {
      this.$store.commit('setStoreUploadNameType', value);
    },
    handleQuickToolbarCommand(command) {
      if (command === 'linkFormat') {
        this.openUrlDialog();
      } else if (command === 'manage') {
        this.handleManage();
      }
    },
    handleChangeUploadMethod() {
      this.uploadMethod = this.uploadMethod === 'default' ? 'paste' : 'default';
      this.$store.commit('setUploadMethod', this.uploadMethod);
    },
    handleMobileMenuCommand(command) {
      if (command === 'toggleUploadMethod') {
        this.handleChangeUploadMethod();
      } else if (command === 'showAnnouncement') {
        this.handleShowAnnouncement();
      } else if (command === 'toggleLanguage') {
        const next = this.$i18n.locale === 'zh-CN' ? 'en' : 'zh-CN';
        setLocale(next);
      }
    },
    handleDesktopMenuCommand(command) {
      if (command === 'showAnnouncement') {
        this.handleShowAnnouncement();
      } else if (command === 'toggleLanguage') {
        const next = this.$i18n.locale === 'zh-CN' ? 'en' : 'zh-CN';
        setLocale(next);
      }
    },
    handleShowAnnouncement() {
      const announcement = this.userConfig?.announcement;
      if (announcement) {
        this.announcementContent = announcement;
        this.showAnnouncementDialog = true;
      } else {
        notifyToast(this.$t('upload.noAnnouncement'));
      }
    },
  }
};
