import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.some.js";
import UploadForm from '@/components/upload/UploadForm.vue';
import { setLocale } from '@/locales';
import UploadSettingsDialog from '@/components/upload/UploadSettingsDialog.vue';
import DirectoryTreePicker from '@/components/DirectoryTreePicker.vue';
import DirectorySuggestionInput from '@/components/DirectorySuggestionInput.vue';
import backgroundManager from '@/mixins/backgroundManager';
import axios from '@/utils/axios';
import { ref } from 'vue';
import { mapGetters } from 'vuex';
import { validateFolderPath } from '@/utils/pathValidator';
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
      //上传方式
      uploadFolder: '',
      // 上传文件夹
      isFolderInputActive: false,
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
      // 切换渠道类型时，检查持久化的渠道名是否在新渠道列表中
      const newChannelList = this.availableChannels[val] || [];
      const savedChannelName = this.storeChannelName;
      if (savedChannelName && newChannelList.some(ch => ch.name === savedChannelName)) {
        // 持久化的渠道名在新渠道列表中，恢复它
        this.channelName = savedChannelName;
      } else {
        // 否则清空
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
    uploadFolder(val) {
      // 实时输入时用非 strict 模式，不检查末尾的单独 . 以允许继续输入如 .123
      if (this.validateUploadFolder(val, false)) {
        // 非 strict 通过后，再用 strict 模式静默检查，只有完全合法才更新 store
        const strictResult = validateFolderPath(val, {
          strict: true
        });
        if (strictResult.valid) {
          this.$store.commit('setStoreUploadFolder', val);
        }
        // strict 不通过时不更新 store，等失焦时提示并回滚
      } else {
        this.$nextTick(() => {
          this.uploadFolder = this.storeUploadFolder;
        });
      }
    }
  },
  computed: {
    ...mapGetters(['userConfig', 'uploadCopyUrlForm', 'compressConfig', 'storeUploadChannel', 'storeChannelName', 'storeUploadNameType', 'customUrlSettings', 'storeAutoRetry', 'storeUploadMethod', 'storeUploadFolder']),
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
    // 是否显示目录候选项（从 userConfig 获取）
    showDirectorySuggestions() {
      return this.userConfig?.showDirectorySuggestions ?? false;
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
    // 读取用户选择的上传渠道
    this.uploadChannel = this.storeUploadChannel || this.userConfig?.defaultUploadChannel || 'telegram';
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
    // 读取用户设置的上传文件夹
    this.uploadFolder = this.storeUploadFolder || this.userConfig?.defaultUploadFolder || '';

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
    UploadSettingsDialog,
    DirectoryTreePicker,
    DirectorySuggestionInput
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
          // 恢复渠道名称：优先持久化的值，其次系统默认配置
          const savedChannelName = this.storeChannelName;
          const defaultChannelName = this.userConfig?.defaultChannelName;
          const currentChannelList = this.availableChannels[this.uploadChannel] || [];

          // 如果用户主动清空过（savedChannelName === ''），则保持为空
          // 如果从未选择过（savedChannelName === null/undefined），则使用默认值
          if (savedChannelName && currentChannelList.some(ch => ch.name === savedChannelName)) {
            this.channelName = savedChannelName;
          } else if (savedChannelName === '' || savedChannelName === null || savedChannelName === undefined) {
            // 用户主动清空或从未选择，检查是否使用默认值
            if (savedChannelName !== '' && defaultChannelName && currentChannelList.some(ch => ch.name === defaultChannelName)) {
              this.channelName = defaultChannelName;
            }
            // 如果 savedChannelName === ''，说明用户主动清空，保持为空
          }
        }
      } catch (error) {
        console.error('Failed to fetch available channels:', error);
      }
    },
    // 验证上传文件夹路径的合法性
    validateUploadFolder(path, strict = true) {
      // 自动补全前导 /
      if (path && !path.startsWith('/')) {
        path = '/' + path;
        this.uploadFolder = path;
      }
      const result = validateFolderPath(path, {
        strict
      });
      if (!result.valid) {
        this.$message.error(result.error);
        return false;
      }
      return true;
    },
    handleFolderInputFocus() {
      this.isFolderInputActive = true;
    },
    handleFolderInputBlur() {
      this.isFolderInputActive = false;
      // 失焦时自动补全前导 /
      if (this.uploadFolder && !this.uploadFolder.startsWith('/')) {
        this.uploadFolder = '/' + this.uploadFolder;
      }
      // 失焦时做完整校验（包括末尾单独的 .）
      if (!this.validateUploadFolder(this.uploadFolder, true)) {
        this.$nextTick(() => {
          this.uploadFolder = this.storeUploadFolder;
        });
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
        this.$message.info(this.$t('upload.noAnnouncement'));
      }
    },
    // 处理目录选择
    handleDirectorySelect(path) {
      // 填入选择的目录路径
      this.uploadFolder = path;
      // 触发路径验证逻辑
      if (this.validateUploadFolder(path, true)) {
        this.$store.commit('setStoreUploadFolder', path);
      }
    }
  }
};
