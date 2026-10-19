import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.filter.js";
import "core-js/modules/es.iterator.find.js";
import "core-js/modules/es.iterator.for-each.js";
import "core-js/modules/es.iterator.map.js";
import "core-js/modules/es.iterator.some.js";
import fetchWithAuth from '@/utils/fetchWithAuth';
import ChannelIcon from '@/components/icons/ChannelIcon.vue';
import CustomSelect from './CustomSelect.vue';
export default {
  components: {
    ChannelIcon,
    CustomSelect
  },
  data() {
    return {
      // 渠道类型筛选
      channelFilter: '',
      // 渠道类型列表
      channels: [{
        value: 'telegram',
        label: 'Telegram'
      }, {
        value: 'cfr2',
        label: 'CloudFlare R2'
      }, {
        value: 's3',
        label: 'S3'
      }, {
        value: 'discord',
        label: 'Discord'
      }, {
        value: 'huggingface',
        label: 'HuggingFace'
      }, {
        value: 'webdav',
        label: 'WebDAV'
      }],
      // 可添加的渠道类型
      addableChannels: [{
        value: 'telegram',
        label: 'Telegram'
      }, {
        value: 'cfr2',
        label: 'CloudFlare R2'
      }, {
        value: 's3',
        label: 'S3'
      }, {
        value: 'discord',
        label: 'Discord'
      }, {
        value: 'huggingface',
        label: 'HuggingFace'
      }, {
        value: 'webdav',
        label: 'WebDAV'
      }],
      // 各渠道配置
      telegramSettings: {
        loadBalance: {
          enabled: false
        },
        channels: []
      },
      cfr2Settings: {
        channels: []
      },
      s3Settings: {
        loadBalance: {
          enabled: false
        },
        channels: []
      },
      discordSettings: {
        loadBalance: {
          enabled: false
        },
        channels: []
      },
      huggingfaceSettings: {
        loadBalance: {
          enabled: false
        },
        channels: []
      },
      webdavSettings: {
        loadBalance: {
          enabled: false
        },
        channels: []
      },
      // 弹窗控制
      showAddDialog: false,
      showDetailDialog: false,
      showEditDialog: false,
      // 当前操作的渠道
      currentChannelType: '',
      currentChannelIndex: -1,
      currentChannel: null,
      editChannel: {},
      // 新增渠道表单
      newChannel: {
        type: '',
        name: '',
        enabled: true,
        // Telegram
        botToken: '',
        chatId: '',
        proxyUrl: '',
        // S3
        endpoint: '',
        cdnDomain: '',
        bucketName: '',
        region: 'auto',
        accessKeyId: '',
        secretAccessKey: '',
        pathStyle: false,
        quota: {
          enabled: false,
          limitGB: 10,
          threshold: 95
        },
        // Discord
        channelId: '',
        isNitro: false,
        // HuggingFace
        repo: '',
        token: '',
        isPrivate: false,
        // WebDAV
        baseUrl: '',
        username: '',
        password: '',
        publicUrl: '',
        headersText: '',
        createDirectory: true
      },
      // 容量统计数据
      quotaStats: {},
      quotaLoading: false,
      // 加载状态
      loading: false
    };
  },
  computed: {
    // 筛选下拉框选项
    filterOptions() {
      return [{
        value: '',
        label: this.$t('common.all')
      }, ...this.channels.map(ch => ({
        value: ch.value,
        label: ch.label,
        channelType: ch.value,
        iconClass: this.getChannelIconClass(ch.value)
      }))];
    },
    // 根据筛选条件过滤渠道类型
    filteredChannels() {
      if (!this.channelFilter) {
        return this.channels;
      }
      return this.channels.filter(ch => ch.value === this.channelFilter);
    },
    addRules() {
      return {
        type: [{
          required: true,
          message: this.$t('sysUpload.channelTypePlaceholder'),
          trigger: 'change'
        }],
        name: [{
          required: true,
          message: this.$t('sysUpload.channelNamePlaceholder'),
          trigger: 'blur'
        }, {
          pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/,
          message: this.$t('sysUpload.channelNamePlaceholder'),
          trigger: 'blur'
        }],
        botToken: [{
          required: true,
          message: this.$t('sysUpload.botTokenPlaceholder'),
          trigger: 'blur'
        }],
        chatId: [{
          required: true,
          message: this.$t('sysUpload.chatIdPlaceholder'),
          trigger: 'blur'
        }],
        channelId: [{
          required: true,
          message: this.$t('sysUpload.channelIdPlaceholder'),
          trigger: 'blur'
        }],
        endpoint: [{
          required: true,
          message: this.$t('sysUpload.endpointPlaceholder'),
          trigger: 'blur'
        }],
        bucketName: [{
          required: true,
          message: this.$t('sysUpload.bucketNamePlaceholder'),
          trigger: 'blur'
        }],
        region: [{
          required: true,
          message: this.$t('sysUpload.bucketRegionPlaceholder'),
          trigger: 'blur'
        }],
        accessKeyId: [{
          required: true,
          message: this.$t('sysUpload.accessKeyIdPlaceholder'),
          trigger: 'blur'
        }],
        secretAccessKey: [{
          required: true,
          message: this.$t('sysUpload.secretAccessKeyPlaceholder'),
          trigger: 'blur'
        }],
        repo: [{
          required: true,
          message: this.$t('sysUpload.repoNamePlaceholder'),
          trigger: 'blur'
        }],
        token: [{
          required: true,
          message: this.$t('sysUpload.accessTokenPlaceholder'),
          trigger: 'blur'
        }],
        baseUrl: [{
          required: true,
          message: this.$t('sysUpload.webdavBaseUrlPlaceholder'),
          trigger: 'blur'
        }]
      };
    },
    editRules() {
      return {
        name: [{
          required: true,
          message: this.$t('sysUpload.channelNamePlaceholder'),
          trigger: 'blur'
        }, {
          pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/,
          message: this.$t('sysUpload.channelNamePlaceholder'),
          trigger: 'blur'
        }],
        botToken: [{
          required: true,
          message: this.$t('sysUpload.botTokenPlaceholder'),
          trigger: 'blur'
        }],
        chatId: [{
          required: true,
          message: this.$t('sysUpload.chatIdPlaceholder'),
          trigger: 'blur'
        }],
        channelId: [{
          required: true,
          message: this.$t('sysUpload.channelIdPlaceholder'),
          trigger: 'blur'
        }],
        endpoint: [{
          required: true,
          message: this.$t('sysUpload.endpointPlaceholder'),
          trigger: 'blur'
        }],
        bucketName: [{
          required: true,
          message: this.$t('sysUpload.bucketNamePlaceholder'),
          trigger: 'blur'
        }],
        region: [{
          required: true,
          message: this.$t('sysUpload.bucketRegionPlaceholder'),
          trigger: 'blur'
        }],
        accessKeyId: [{
          required: true,
          message: this.$t('sysUpload.accessKeyIdPlaceholder'),
          trigger: 'blur'
        }],
        secretAccessKey: [{
          required: true,
          message: this.$t('sysUpload.secretAccessKeyPlaceholder'),
          trigger: 'blur'
        }],
        repo: [{
          required: true,
          message: this.$t('sysUpload.repoNamePlaceholder'),
          trigger: 'blur'
        }],
        token: [{
          required: true,
          message: this.$t('sysUpload.accessTokenPlaceholder'),
          trigger: 'blur'
        }],
        baseUrl: [{
          required: true,
          message: this.$t('sysUpload.webdavBaseUrlPlaceholder'),
          trigger: 'blur'
        }]
      };
    }
  },
  methods: {
    // 卡片光斑跟随鼠标
    handleCardMouseMove(event, channelType, index) {
      const card = event.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const refKey = `glow-${channelType}-${index}`;
      const glowEl = this.$refs[refKey];
      if (glowEl && glowEl[0]) {
        glowEl[0].style.opacity = '1';
        glowEl[0].style.left = `${x}px`;
        glowEl[0].style.top = `${y}px`;
      }
    },
    handleCardMouseLeave(channelType, index) {
      const refKey = `glow-${channelType}-${index}`;
      const glowEl = this.$refs[refKey];
      if (glowEl && glowEl[0]) {
        glowEl[0].style.opacity = '0';
      }
    },
    getChannelIconClass(type) {
      return `channel-brand-${type}`;
    },
    // 获取渠道类型标签
    getChannelTypeLabel(type) {
      const channel = this.channels.find(c => c.value === type);
      return channel ? channel.label : type;
    },
    // 获取渠道列表
    getChannelList(type) {
      return this.getSettings(type)?.channels || [];
    },
    // 获取渠道设置对象
    getSettings(type) {
      const map = {
        telegram: this.telegramSettings,
        cfr2: this.cfr2Settings,
        s3: this.s3Settings,
        discord: this.discordSettings,
        huggingface: this.huggingfaceSettings,
        webdav: this.webdavSettings
      };
      return map[type];
    },
    // 是否有负载均衡选项
    hasLoadBalance(type) {
      return ['telegram', 's3', 'discord', 'huggingface', 'webdav'].includes(type);
    },
    // 文本脱敏
    maskText(text, showLength = 4) {
      if (!text) return this.$t('sysUpload.notSet');
      if (text.length <= showLength * 2) return '****';
      return text.slice(0, showLength) + '****' + text.slice(-showLength);
    },
    formatHeaders(headers) {
      if (!headers || typeof headers === 'object' && Object.keys(headers).length === 0) {
        return this.$t('sysUpload.notSet');
      }
      if (typeof headers === 'string') {
        return headers;
      }
      return JSON.stringify(headers, null, 2);
    },
    headersToText(headers) {
      if (!headers) return '';
      if (typeof headers === 'string') return headers;
      return JSON.stringify(headers, null, 2);
    },
    parseHeadersText(text) {
      if (!text || !text.trim()) return {};
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return null;
        }
        return parsed;
      } catch (error) {
        return null;
      }
    },
    // 打开详情弹窗
    openDetailDialog(type, index) {
      this.currentChannelType = type;
      this.currentChannelIndex = index;
      this.currentChannel = this.getChannelList(type)[index];
      this.showDetailDialog = true;
    },
    // 打开编辑弹窗
    openEditDialog(type, index) {
      this.currentChannelType = type;
      this.currentChannelIndex = index;
      const channel = this.getChannelList(type)[index];
      this.editChannel = JSON.parse(JSON.stringify(channel));
      if (type === 'webdav') {
        this.editChannel.headersText = this.headersToText(this.editChannel.headers);
        this.editChannel.createDirectory = this.editChannel.createDirectory !== false;
      }
      // 确保 quota 对象存在
      if (!this.editChannel.quota) {
        this.editChannel.quota = {
          enabled: false,
          limitGB: 10,
          threshold: 95
        };
      }
      this.showEditDialog = true;
    },
    // 从详情页打开编辑
    openEditFromDetail() {
      this.showDetailDialog = false;
      this.openEditDialog(this.currentChannelType, this.currentChannelIndex);
    },
    // 重置添加表单
    resetAddForm() {
      this.newChannel = {
        type: '',
        name: '',
        enabled: true,
        botToken: '',
        chatId: '',
        proxyUrl: '',
        endpoint: '',
        bucketName: '',
        region: 'auto',
        accessKeyId: '',
        secretAccessKey: '',
        pathStyle: false,
        quota: {
          enabled: false,
          limitGB: 10,
          threshold: 95
        },
        channelId: '',
        isNitro: false,
        repo: '',
        token: '',
        isPrivate: false,
        baseUrl: '',
        username: '',
        password: '',
        publicUrl: '',
        headersText: '',
        createDirectory: true
      };
    },
    // 重置详情弹窗数据
    resetDetailData() {
      this.currentChannel = null;
    },
    // 重置编辑弹窗数据
    resetEditData() {
      this.editChannel = {};
    },
    // 渠道类型变更时重置表单
    onChannelTypeChange() {
      // 保留 type 和 name，重置其他字段
      const {
        type,
        name
      } = this.newChannel;
      this.newChannel = {
        type,
        name,
        enabled: true,
        botToken: '',
        chatId: '',
        proxyUrl: '',
        endpoint: '',
        cdnDomain: '',
        bucketName: '',
        region: 'auto',
        accessKeyId: '',
        secretAccessKey: '',
        pathStyle: false,
        quota: {
          enabled: false,
          limitGB: 10,
          threshold: 95
        },
        channelId: '',
        isNitro: false,
        repo: '',
        token: '',
        isPrivate: false,
        baseUrl: '',
        username: '',
        password: '',
        publicUrl: '',
        headersText: '',
        createDirectory: true
      };
    },
    // 确认添加渠道
    confirmAddChannel() {
      this.$refs.addForm.validate(valid => {
        if (!valid) return;
        const {
          type,
          name
        } = this.newChannel;
        const settings = this.getSettings(type);

        // 检查是否为保留名称（{type}_env）
        const reservedNames = ['Telegram_env', 'R2_env', 'S3_env', 'Discord_env', 'HuggingFace_env', 'WebDAV_env'];
        if (reservedNames.includes(name)) {
          this.$message.warning(this.$t('sysUpload.reservedName'));
          return;
        }

        // 检查名称是否重复
        const isDuplicate = settings.channels.some(ch => ch.name === name);
        if (isDuplicate) {
          this.$message.warning(this.$t('sysUpload.duplicateName'));
          return;
        }
        let newChannelData = {
          id: settings.channels.length + 1,
          name: this.newChannel.name,
          type: type,
          savePath: 'database',
          enabled: true,
          fixed: false
        };

        // 根据类型添加特定字段
        if (type === 'telegram') {
          Object.assign(newChannelData, {
            botToken: this.newChannel.botToken,
            chatId: this.newChannel.chatId,
            proxyUrl: this.newChannel.proxyUrl
          });
        } else if (type === 's3') {
          Object.assign(newChannelData, {
            endpoint: this.newChannel.endpoint,
            cdnDomain: this.newChannel.cdnDomain,
            bucketName: this.newChannel.bucketName,
            region: this.newChannel.region,
            accessKeyId: this.newChannel.accessKeyId,
            secretAccessKey: this.newChannel.secretAccessKey,
            pathStyle: this.newChannel.pathStyle,
            quota: {
              ...this.newChannel.quota
            }
          });
        } else if (type === 'discord') {
          Object.assign(newChannelData, {
            botToken: this.newChannel.botToken,
            channelId: this.newChannel.channelId,
            proxyUrl: this.newChannel.proxyUrl,
            isNitro: this.newChannel.isNitro
          });
        } else if (type === 'huggingface') {
          Object.assign(newChannelData, {
            repo: this.newChannel.repo,
            token: this.newChannel.token,
            isPrivate: this.newChannel.isPrivate
          });
        } else if (type === 'webdav') {
          const headers = this.parseHeadersText(this.newChannel.headersText);
          if (headers === null) {
            this.$message.warning(this.$t('sysUpload.webdavHeadersInvalid'));
            return;
          }
          Object.assign(newChannelData, {
            baseUrl: this.newChannel.baseUrl,
            username: this.newChannel.username,
            password: this.newChannel.password,
            publicUrl: this.newChannel.publicUrl,
            headers,
            createDirectory: this.newChannel.createDirectory !== false,
            quota: {
              ...this.newChannel.quota
            }
          });
        }
        settings.channels.push(newChannelData);
        this.showAddDialog = false;
        // 自动保存全部设置
        this.saveSettings();
      });
    },
    // 确认编辑渠道
    confirmEditChannel() {
      this.$refs.editForm.validate(valid => {
        if (!valid) return;
        const settings = this.getSettings(this.currentChannelType);
        const currentIndex = this.currentChannelIndex;
        const originalName = settings.channels[currentIndex]?.name || this.editChannel.name;
        const editedChannel = {
          ...this.editChannel,
          name: originalName
        };
        if (this.currentChannelType === 'webdav') {
          const headers = this.parseHeadersText(editedChannel.headersText);
          if (headers === null) {
            this.$message.warning(this.$t('sysUpload.webdavHeadersInvalid'));
            return;
          }
          editedChannel.headers = headers;
          editedChannel.createDirectory = editedChannel.createDirectory !== false;
          delete editedChannel.headersText;
        }
        settings.channels[this.currentChannelIndex] = editedChannel;
        this.showEditDialog = false;
        // 自动保存全部设置
        this.saveSettings();
      });
    },
    // 删除渠道
    deleteChannel(type, index) {
      const channel = this.getChannelList(type)[index];
      if (channel.fixed) {
        this.$message.warning(this.$t('sysUpload.fixedChannelCannotDelete'));
        return;
      }
      this.$confirm(this.$t('sysUpload.deleteChannelConfirm'), this.$t('common.warning'), {
        confirmButtonText: this.$t('common.confirm'),
        cancelButtonText: this.$t('common.cancel'),
        type: 'warning'
      }).then(() => {
        const settings = this.getSettings(type);
        settings.channels.splice(index, 1);
        // 重新调整 id
        settings.channels.forEach((item, i) => {
          item.id = i + 1;
        });
        // 自动保存
        this.saveSettings();
      }).catch(() => {});
    },
    saveSettings() {
      // 保存设置
      const settings = {
        telegram: this.telegramSettings,
        cfr2: this.cfr2Settings,
        s3: this.s3Settings,
        discord: this.discordSettings,
        huggingface: this.huggingfaceSettings,
        webdav: this.webdavSettings
      };
      fetchWithAuth('/api/manage/sysConfig/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      }).then(() => {
        this.$message.success(this.$t('sysOthers.settingsSaved'));
      });
    },
    // 获取容量统计（重新计算）
    async refreshQuota() {
      this.quotaLoading = true;
      try {
        // 使用 POST 请求重新统计容量（会触发索引重建）
        const response = await fetchWithAuth('/api/manage/quota', {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          this.quotaStats = data.channelStats || {};
        } else {
          // 如果重新统计失败，尝试获取已有数据
          const getResponse = await fetchWithAuth('/api/manage/quota');
          const getData = await getResponse.json();
          if (getData.success) {
            this.quotaStats = getData.quotaStats || {};
          }
        }
      } catch (error) {
        console.error('Failed to refresh quota stats:', error);
      } finally {
        this.quotaLoading = false;
      }
    },
    // 获取容量统计（仅读取，不重建索引）
    async loadQuotaStats() {
      try {
        const response = await fetchWithAuth('/api/manage/quota');
        const data = await response.json();
        if (data.success) {
          this.quotaStats = data.quotaStats || {};
        }
      } catch (error) {
        console.error('Failed to load quota stats:', error);
      }
    },
    // 获取渠道已用容量 (GB)
    getChannelUsedGB(channel) {
      const stats = this.quotaStats[channel.name];
      if (!stats) return 0;
      return (stats.usedMB || 0) / 1024;
    },
    // 获取容量百分比
    getQuotaPercentage(channel) {
      const usedGB = this.getChannelUsedGB(channel);
      const limitGB = channel.quota?.limitGB || 10;
      const percentage = usedGB / limitGB * 100;
      return Math.min(100, Math.round(percentage * 10) / 10);
    },
    // 获取进度条状态
    getQuotaStatus(channel) {
      const percentage = this.getQuotaPercentage(channel);
      const threshold = channel.quota?.threshold || 95;
      if (percentage >= threshold) return 'exception';
      if (percentage >= 80) return 'warning';
      return 'success';
    },
    // 获取容量文本
    getQuotaText(channel) {
      const usedGB = this.getChannelUsedGB(channel);
      const limitGB = channel.quota?.limitGB || 10;
      return `${usedGB.toFixed(2)} / ${limitGB} GB`;
    },
    // 判断是否超过阈值
    isQuotaExceeded(channel) {
      const percentage = this.getQuotaPercentage(channel);
      const threshold = channel.quota?.threshold || 95;
      return percentage >= threshold;
    },
    // 获取状态文本
    getQuotaStatusText(channel) {
      const percentage = this.getQuotaPercentage(channel);
      const threshold = channel.quota?.threshold || 95;
      if (percentage >= threshold) {
        return `⚠️ 已达到容量阈值 (${threshold}%)，渠道写入已暂停`;
      }
      if (percentage >= 80) {
        return `⚡ 容量使用较高，接近阈值`;
      }
      return `✓ 容量正常`;
    },
    // 容量限制开关变化时
    async onQuotaEnabledChange(enabled, channel) {
      if (enabled && channel.name) {
        // 首次启用时，检查是否有该渠道的统计数据
        const stats = this.quotaStats[channel.name];
        if (!stats) {
          // 没有统计数据，提示用户需要重新统计
          this.$confirm(this.$t('sysUpload.quotaInitConfirm'), this.$t('sysUpload.quotaInitTitle'), {
            confirmButtonText: this.$t('sysUpload.quotaInitConfirmBtn'),
            cancelButtonText: this.$t('sysUpload.quotaInitCancelBtn'),
            type: 'info'
          }).then(async () => {
            await this.recalculateQuota();
          }).catch(() => {
            this.$message.info(this.$t('sysUpload.quotaInitLater'));
          });
        }
      }
    },
    // 重新统计容量
    async recalculateQuota() {
      this.quotaLoading = true;
      try {
        this.$message.info(this.$t('sysUpload.quotaCalculating'));
        const response = await fetchWithAuth('/api/manage/quota', {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          this.quotaStats = data.channelStats || {};
          this.$message.success(this.$t('sysUpload.quotaCalculateSuccess'));
        } else {
          this.$message.error(this.$t('sysUpload.quotaCalculateError') + (data.error || ''));
        }
      } catch (error) {
        console.error('Failed to recalculate quota:', error);
        this.$message.error(this.$t('sysUpload.quotaCalculateFailed'));
      } finally {
        this.quotaLoading = false;
      }
    }
  },
  mounted() {
    this.loading = true;
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/upload').then(response => response.json()).then(data => {
      this.telegramSettings = data.telegram;
      // 确保 R2 渠道有 quota 默认值
      if (data.cfr2 && data.cfr2.channels) {
        data.cfr2.channels = data.cfr2.channels.map(channel => ({
          ...channel,
          quota: channel.quota || {
            enabled: false,
            limitGB: 10,
            threshold: 95
          }
        }));
      }
      this.cfr2Settings = data.cfr2;
      // 确保 S3 渠道有 quota 默认值
      if (data.s3 && data.s3.channels) {
        data.s3.channels = data.s3.channels.map(channel => ({
          ...channel,
          quota: channel.quota || {
            enabled: false,
            limitGB: 10,
            threshold: 95
          }
        }));
      }
      this.s3Settings = data.s3;
      // 确保 Discord 渠道有默认值
      if (data.discord && data.discord.channels) {
        data.discord.channels = data.discord.channels.map(channel => ({
          ...channel,
          proxyUrl: channel.proxyUrl || ''
        }));
      }
      this.discordSettings = data.discord || {
        loadBalance: {},
        channels: []
      };
      // 确保 HuggingFace 渠道有默认值
      if (data.huggingface && data.huggingface.channels) {
        data.huggingface.channels = data.huggingface.channels.map(channel => ({
          ...channel,
          isPrivate: channel.isPrivate || false
        }));
      }
      this.huggingfaceSettings = data.huggingface || {
        loadBalance: {},
        channels: []
      };
      // 确保 WebDAV 渠道有默认值
      if (data.webdav && data.webdav.channels) {
        data.webdav.channels = data.webdav.channels.map(channel => ({
          ...channel,
          username: channel.username || '',
          password: channel.password || '',
          publicUrl: channel.publicUrl || '',
          headers: channel.headers || {},
          createDirectory: channel.createDirectory !== false,
          quota: channel.quota || {
            enabled: false,
            limitGB: 10,
            threshold: 95
          }
        }));
      }
      this.webdavSettings = data.webdav || {
        loadBalance: {},
        channels: []
      };
      // 加载容量统计（仅读取，不重建索引）
      this.loadQuotaStats();
    }).finally(() => {
      this.loading = false;
    });
  }
};