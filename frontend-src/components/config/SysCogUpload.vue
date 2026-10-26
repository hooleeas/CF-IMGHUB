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
import notifyToast from '@/utils/notifyToast';

function generateChannelId(usedIds) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = new Uint8Array(5);
    window.crypto.getRandomValues(bytes);
    const id = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
    if (!usedIds.has(id)) return id;
  }
  throw new Error('无法生成唯一的渠道 ID。');
}

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
      // 加载状态
      loading: false
    };
  },
  watch: {
    enabledChannelOptions: {
      deep: true,
      handler(options) {
        window.dispatchEvent(new CustomEvent('imgbed:upload-channels-changed', {
          detail: { options }
        }));
      }
    }
  },
  computed: {
    enabledChannelOptions() {
      const channelLabels = {
        telegram: 'Telegram',
        cfr2: 'R2',
        s3: 'S3',
        discord: 'Discord',
        huggingface: 'HuggingFace',
        webdav: 'WebDAV'
      };
      return this.channels.flatMap(({ value }) =>
        this.getChannelList(value)
          .filter(channel => channel.enabled)
          .map(channel => {
            const typeLabel = channelLabels[value];
            const label = channel.name === typeLabel
              ? typeLabel
              : `${typeLabel} — ${channel.name}`;
            return { value: channel.id, label, label_en: label };
          })
      );
    },
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
    createChannelId() {
      const usedIds = new Set(this.channels.flatMap(({ value }) =>
        this.getChannelList(value).map(channel => channel.id)
      ));
      return generateChannelId(usedIds);
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
        if (type === 'cfr2' && this.cfr2Settings.channels.length > 0) {
          notifyToast(this.$t('sysUpload.r2ChannelLimit'), 'error');
          return;
        }
        const settings = this.getSettings(type);

        // 检查是否为保留名称（{type}_env）
        const reservedNames = ['Telegram_env', 'S3_env', 'Discord_env', 'HuggingFace_env', 'WebDAV_env'];
        if (reservedNames.includes(name)) {
          notifyToast(this.$t('sysUpload.reservedName'), 'error');
          return;
        }

        // 检查名称是否重复
        const isDuplicate = settings.channels.some(ch => ch.name === name);
        if (isDuplicate) {
          notifyToast(this.$t('sysUpload.duplicateName'), 'error');
          return;
        }
        let newChannelData = {
          id: this.createChannelId(),
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
            pathStyle: this.newChannel.pathStyle
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
            notifyToast(this.$t('sysUpload.webdavHeadersInvalid'), 'error');
            return;
          }
          Object.assign(newChannelData, {
            baseUrl: this.newChannel.baseUrl,
            username: this.newChannel.username,
            password: this.newChannel.password,
            publicUrl: this.newChannel.publicUrl,
            headers,
            createDirectory: this.newChannel.createDirectory !== false
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
        const editedChannel = {
          ...this.editChannel,
          name: this.editChannel.name.trim()
        };
        delete editedChannel.quota;
        if (this.currentChannelType === 'webdav') {
          const headers = this.parseHeadersText(editedChannel.headersText);
          if (headers === null) {
            notifyToast(this.$t('sysUpload.webdavHeadersInvalid'), 'error');
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
        notifyToast(this.$t('sysUpload.fixedChannelCannotDelete'), 'error');
        return;
      }
      this.$confirm(this.$t('sysUpload.deleteChannelConfirm'), this.$t('common.warning'), {
        confirmButtonText: this.$t('common.confirm'),
        cancelButtonText: this.$t('common.cancel'),
        type: 'warning'
      }).then(() => {
        const settings = this.getSettings(type);
        settings.channels.splice(index, 1);
        // 自动保存
        this.saveSettings();
      }).catch(() => {});
    },
    async saveSettings() {
      // 保存设置
      const settings = {
        telegram: this.telegramSettings,
        cfr2: this.cfr2Settings,
        s3: this.s3Settings,
        discord: this.discordSettings,
        huggingface: this.huggingfaceSettings,
        webdav: this.webdavSettings
      };
      try {
        const response = await fetchWithAuth('/api/manage/sysConfig/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error(`Settings save failed (${response.status})`);
        notifyToast(this.$t('sysOthers.settingsSaved'));
      } catch (error) {
        console.error('Failed to save upload settings:', error);
        notifyToast(error.message || '保存上传渠道设置失败，请稍后重试。', 'error');
      }
    },
  },
  mounted() {
    this.loading = true;
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/upload').then(response => response.json()).then(data => {
      this.telegramSettings = data.telegram;
      this.cfr2Settings = data.cfr2;
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
          createDirectory: channel.createDirectory !== false
        }));
      }
      this.webdavSettings = data.webdav || {
        loadBalance: {},
        channels: []
      };
    }).finally(() => {
      this.loading = false;
    });
  }
};