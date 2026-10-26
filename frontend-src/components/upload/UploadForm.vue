import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.filter.js";
import "core-js/modules/es.iterator.find.js";
import "core-js/modules/es.iterator.for-each.js";
import "core-js/modules/es.iterator.map.js";
import "core-js/modules/es.iterator.reduce.js";
import "core-js/modules/es.typed-array.with.js";
import "core-js/modules/esnext.uint8-array.set-from-base64.js";
import "core-js/modules/esnext.uint8-array.set-from-hex.js";
import "core-js/modules/esnext.uint8-array.to-base64.js";
import "core-js/modules/esnext.uint8-array.to-hex.js";
import "core-js/modules/web.dom-exception.stack.js";
import axios from '@/utils/axios';
import * as imageConversion from 'image-conversion';
import { mapGetters } from 'vuex';
import { buildFileUrls, updateFileListUrls, getUrlByFormat } from '@/utils/upload/urlBuilder';
import { computeSha256 } from '@/utils/upload/sha256';
import UploadFileItem from '@/components/upload/UploadFileItem.vue';
import notifyToast from '@/utils/notifyToast';
export default {
  name: 'UploadForm',
  components: {
    UploadFileItem
  },
  props: {
    selectedUrlForm: {
      type: String,
      default: 'url',
      required: false
    },
    customerCompress: {
      type: Boolean,
      default: true,
      required: false
    },
    compressQuality: {
      type: Number,
      default: 4,
      required: false
    },
    compressBar: {
      type: Number,
      default: 5,
      required: false
    },
    serverCompress: {
      type: Boolean,
      default: true,
      required: false
    },
    uploadChannel: {
      type: String,
      default: 'telegram',
      required: false
    },
    channelName: {
      type: String,
      default: '',
      required: false
    },
    uploadNameType: {
      type: String,
      default: 'default',
      required: false
    },
    useCustomUrl: {
      type: String,
      default: 'false',
      required: false
    },
    customUrlPrefix: {
      type: String,
      default: '',
      required: false
    },
    autoRetry: {
      type: Boolean,
      default: true,
      required: false
    },
    urlPrefix: {
      type: String,
      default: '',
      required: false
    },
    uploadMethod: {
      type: String,
      default: 'default',
      required: false
    },
    convertToWebp: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  data() {
    return {
      fileList: [],
      uploading: false,
      maxUploading: 6,
      exceptionList: [],
      listScrolled: false,
      fileListLength: 0,
      uploadCount: 0,
      pastedUrls: '',
      pasteUploadMethod: 'save',
      // 失败文件不自动重试，保留错误状态供用户处理。
      autoReUpload: false,
      maxRetryCount: 10,
      // 最大重试次数
      retryTimer: null,
      // 自动重试定时器
      retryDelay: 12000,
      // 重试延迟时间（毫秒）
      // 批量上传并发控制
      uploadQueue: [],
      // 等待上传的文件队列
      activeUploads: 0,
      // 当前正在上传的文件数
      maxConcurrentUploads: 1,
      // 每次只上传一个文件
      clipboardPasteBatch: null,
      // 取消上传控制
      abortControllers: new Map() // 存储每个文件的 AbortController
    };
  },
  watch: {
    fileList: {
      handler() {
        if (this.fileList.length > this.fileListLength) {
          this.$nextTick(() => {
            setTimeout(() => {
              if (this.$refs.scrollContainer) {
                // this.$refs.scrollContainer.setScrollTop(this.$refs.scrollContainer.wrapRef.scrollHeight) // 滚动到底部
                this.$refs.scrollContainer.setScrollTop(0); // 滚动到顶部
              }
            }, 100);
          });
        }
        this.fileListLength = this.fileList.length;
      },
      deep: true
    },
    useCustomUrl: {
      handler() {
        updateFileListUrls(this.fileList, this.rootUrl);
      },
      immediate: true
    },
    customUrlPrefix: {
      handler() {
        if (this.useCustomUrl === 'true') {
          updateFileListUrls(this.fileList, this.rootUrl);
        }
      },
      immediate: true
    },
    autoReUpload(val) {
      this.$store.commit('setStoreAutoReUpload', val);
    }
  },
  computed: {
    ...mapGetters(['storeAutoReUpload']),
    uploadSuccessCount() {
      return this.fileList.filter(item => item.status === 'done' || item.status === 'success').length;
    },
    uploadErrorCount() {
      return this.fileList.filter(item => item.status === 'exception').length;
    },
    uploadingCount() {
      return this.fileList.filter(item => item.status === 'uploading').length;
    },
    waitingCount() {
      return this.uploadQueue.length;
    },
    urlSize() {
      // 移动端为small
      return window.innerWidth < 768 ? 'small' : 'default';
    },
    disableTooltip() {
      return window.innerWidth < 768;
    },
    rootUrl() {
      // 链接前缀，优先级：用户自定义 > urlPrefix > 默认
      return this.useCustomUrl === 'true' ? this.customUrlPrefix : this.urlPrefix || `${window.location.protocol}//${window.location.host}/file/`;
    },
    pasteCardMethodButtonSize() {
      if (this.fileList.length) {
        return 'small';
      } else {
        return window.innerWidth < 768 ? 'small' : 'medium';
      }
    }
  },
  mounted() {
    document.addEventListener('paste', this.handlePaste);
    this.autoReUpload = this.storeAutoReUpload;
  },
  beforeUnmount() {
    document.removeEventListener('paste', this.handlePaste);
    // 清理状态
    this.uploadQueue = [];
    this.fileList = [];
    this.activeUploads = 0;
  },
  methods: {
    // 文件名中间截断，保留前缀和扩展名
    truncateFilename(filename, maxLength = 20) {
      if (!filename || filename.length <= maxLength) {
        return filename;
      }
      const lastDotIndex = filename.lastIndexOf('.');
      let name, ext;
      if (lastDotIndex > 0) {
        name = filename.substring(0, lastDotIndex);
        ext = filename.substring(lastDotIndex);
      } else {
        name = filename;
        ext = '';
      }
      // 保留扩展名和部分前后缀
      const keepEnd = ext.length + 4; // 扩展名 + 4个字符
      const keepStart = maxLength - keepEnd - 3; // 3个字符留给...
      if (keepStart <= 0) {
        return filename.substring(0, maxLength - 3) + '...';
      }
      return name.substring(0, keepStart) + '...' + name.slice(-4) + ext;
    },
    uploadFile(file) {
      // 如果fileList中不存在该文件，说明已被删除，直接返回
      const fileItem = this.fileList.find(item => item.uid === file.file.uid);
      if (!fileItem) {
        return;
      }

      const uploadChannel = fileItem.uploadChannel || this.uploadChannel;
      if (uploadChannel !== 'external' && !this.channelName) {
        fileItem.status = 'exception';
        notifyToast('未选择渠道名称，请选择存储渠道后再上传。', 'error');
        return;
      }

      // 并发控制：如果当前上传数已达上限，加入队列等待
      if (this.activeUploads >= this.maxConcurrentUploads) {
        this.uploadQueue.push(file);
        const waitingItem = this.fileList.find(item => item.uid === file.file.uid);
        if (waitingItem) waitingItem.status = 'waiting';
        return;
      }

      // 开始上传，增加计数
      this.activeUploads++;
      const uploadingItem = this.fileList.find(item => item.uid === file.file.uid);
      if (uploadingItem) uploadingItem.status = 'uploading';

      // 如果上传渠道为外链，直接使用外链上传
      if (uploadChannel === 'external') {
        this.uploadSingleFile(file);
        return;
      }

      // HuggingFace 渠道：根据文件大小选择上传方式
      // 小文件（<20MB）：通过 CF Workers 代理上传
      // 大文件（>=20MB）：前端直传到 HuggingFace S3，绕过 CF Workers 限制
      if (uploadChannel === 'huggingface') {
        const HF_DIRECT_THRESHOLD = 20 * 1024 * 1024; // 20MB
        if (file.file.size >= HF_DIRECT_THRESHOLD) {
          this.uploadToHuggingFaceDirect(file);
        } else {
          this.uploadSingleFile(file);
        }
        return;
      }

      // Discord 渠道：限制 10MB，超过 9MB 就用分块上传（留安全余量）
      if (uploadChannel === 'discord') {
        const DISCORD_CHUNK_THRESHOLD = 9 * 1024 * 1024; // 9MB
        if (file.file.size > DISCORD_CHUNK_THRESHOLD) {
          this.uploadFileInChunks(file);
        } else {
          this.uploadSingleFile(file);
        }
        return;
      }

      // 其他渠道，检查文件大小，决定是否使用分块上传
      const CHUNK_THRESHOLD = 20 * 1024 * 1024; // 20MB
      if (file.file.size > CHUNK_THRESHOLD) {
        this.uploadFileInChunks(file);
      } else {
        this.uploadSingleFile(file);
      }
    },
    // 处理上传队列中的下一个文件
    processUploadQueue() {
      // 如果队列为空或已达并发上限，不处理
      if (this.uploadQueue.length === 0 || this.activeUploads >= this.maxConcurrentUploads) {
        return;
      }

      // 从队列中取出下一个文件并上传
      const nextFile = this.uploadQueue.shift();
      if (nextFile && this.fileList.find(item => item.uid === nextFile.file.uid)) {
        this.uploadFile(nextFile);
      } else {
        // 如果文件已被删除，继续处理下一个
        this.processUploadQueue();
      }
    },
    // 上传完成后的清理工作（成功或失败都调用）
    onUploadComplete() {
      this.activeUploads = Math.max(0, this.activeUploads - 1);

      // 处理队列中的下一个文件
      this.processUploadQueue();

      // 更新上传状态
      if (this.activeUploads === 0 && this.uploadQueue.length === 0) {
        this.uploading = false;
      }
    },
    // 单文件上传
    async uploadSingleFile(file) {
      const fileItem = this.fileList.find(item => item.uid === file.file.uid);
      if (!fileItem) return; // 文件已被删除

      const needServerCompress = fileItem.serverCompress;
      const uploadChannel = fileItem.uploadChannel || this.uploadChannel;
      const autoRetry = this.autoRetry && uploadChannel !== 'external';
      const uploadNameType = uploadChannel === 'external' ? 'default' : this.uploadNameType;

      // 创建 AbortController 用于取消上传
      const abortController = new AbortController();
      this.abortControllers.set(file.file.uid, abortController);
      const formData = new FormData();
      formData.append('file', file.file);
      if (uploadChannel === 'external') {
        formData.append('url', file.file.url);
      }

      // HuggingFace 渠道：在前端预计算 SHA256，避免后端 CPU 超时
      if (uploadChannel === 'huggingface') {
        try {
          console.log('Computing SHA256 for HuggingFace upload...');
          const sha256 = await computeSha256(file.file);
          formData.append('sha256', sha256);
          console.log('SHA256 computed:', sha256);
        } catch (err) {
          console.error('Failed to compute SHA256:', err);
          // 继续上传，让后端计算（可能会超时）
        }
      }
      axios({
        url: '/upload' + '?serverCompress=' + needServerCompress + '&uploadChannel=' + uploadChannel + (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') + '&uploadNameType=' + uploadNameType + '&autoRetry=' + autoRetry,
        method: 'post',
        data: formData,
        withAuthCode: true,
        signal: abortController.signal,
        // 添加取消信号
        onUploadProgress: progressEvent => {
          const percentCompleted = Math.round(progressEvent.loaded / progressEvent.total * 100);
          file.onProgress({
            percent: percentCompleted,
            file: file.file
          });
        }
      }).then(res => {
        file.onSuccess(res, file.file);
      }).catch(err => {
        // 如果是取消操作，不加入异常列表
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          console.log('上传已取消:', file.file.name);
          return;
        }
        if (err.response && err.response.status !== 401) {
          this.exceptionList.push(file);
          file.onError(err, file.file);
        } else if (!err.response) {
          // 网络错误（如 ERR_HTTP2_PROTOCOL_ERROR），也加入异常列表
          this.exceptionList.push(file);
          file.onError(err, file.file);
        }
      }).finally(() => {
        // 清理 AbortController
        this.abortControllers.delete(file.file.uid);
        // 调用并发控制的完成回调
        this.onUploadComplete();
      });
    },
    // 分块上传
    async uploadFileInChunks(file) {
      const fileItem = this.fileList.find(item => item.uid === file.file.uid);
      if (!fileItem) return; // 文件已被删除

      const uploadChannel = fileItem.uploadChannel || this.uploadChannel;

      // 创建 AbortController 用于取消上传
      const abortController = new AbortController();
      this.abortControllers.set(file.file.uid, abortController);

      // Discord 使用 9MB 分块（留安全余量，Discord 限制 10MB）
      // Telegram 使用 16MB 分块（TG Bot getFile 下载限制 20MB，留 4MB 安全余量）
      // 其他渠道使用 16MB 分块
      const CHUNK_SIZE = uploadChannel === 'discord' ? 9 * 1024 * 1024 // 9MB for Discord
      : 16 * 1024 * 1024; // 16MB for Telegram and others (TG getFile limit: 20MB)

      const fileSize = file.file.size;
      const fileType = file.file.type || 'application/octet-stream';
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const needServerCompress = fileItem.serverCompress;
      const autoRetry = this.autoRetry && uploadChannel !== 'external';
      const uploadNameType = uploadChannel === 'external' ? 'default' : this.uploadNameType;

      // HuggingFace 渠道：在前端预计算 SHA256
      let precomputedSha256 = null;
      if (uploadChannel === 'huggingface') {
        try {
          console.log('Computing SHA256 for HuggingFace chunked upload...');
          precomputedSha256 = await computeSha256(file.file);
          console.log('SHA256 computed:', precomputedSha256);
        } catch (err) {
          console.error('Failed to compute SHA256:', err);
        }
      }
      try {
        // 第一步：初始化分块上传，获取uploadId
        const initFormData = new FormData();
        initFormData.append('originalFileName', file.file.name);
        initFormData.append('originalFileType', fileType);
        initFormData.append('totalChunks', totalChunks.toString());
        const initResponse = await axios({
          url: '/upload' + '?serverCompress=' + needServerCompress + '&uploadChannel=' + uploadChannel + (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') + '&uploadNameType=' + uploadNameType + '&autoRetry=' + autoRetry + '&initChunked=true',
          method: 'post',
          data: initFormData,
          withAuthCode: true
        });
        if (!initResponse.data.success) {
          throw new Error(this.$t('uploadForm.chunkInitFailed') + ': ' + initResponse.data.message);
        }
        const uploadId = initResponse.data.uploadId;
        console.log('分块上传初始化成功，uploadId:', uploadId);

        // 记录 totalChunks 和 uploadId 到文件项，用于后续清理
        const fileItem = this.fileList.find(item => item.uid === file.file.uid);
        if (fileItem) {
          fileItem.totalChunks = totalChunks;
          fileItem.uploadId = uploadId;
        }

        // 第二步：并发上传所有分块
        const maxConcurrency = 3; // 最大并发数
        const chunkProgress = new Array(totalChunks).fill(0);
        let nextChunkIndex = 0;
        let hasError = false;
        let errorMsg = '';
        let isCancelled = false; // 标记是否被取消

        const uploadChunk = async chunkIndex => {
          if (hasError || isCancelled) return;
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const chunk = file.file.slice(start, end);
          const formData = new FormData();
          formData.append('file', chunk, `${file.file.name}.part${chunkIndex.toString().padStart(3, '0')}`);
          formData.append('chunkIndex', chunkIndex.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('uploadId', uploadId);
          formData.append('originalFileName', file.file.name);
          formData.append('originalFileType', fileType);
          let retryCount = 0;
          const maxRetries = 3;
          while (retryCount < maxRetries) {
            if (hasError || isCancelled) return;
            try {
              await axios({
                url: '/upload' + '?serverCompress=' + needServerCompress + '&uploadChannel=' + uploadChannel + (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') + '&uploadNameType=' + uploadNameType + '&autoRetry=' + autoRetry + '&chunked=true',
                method: 'post',
                data: formData,
                withAuthCode: true,
                signal: abortController.signal,
                // 添加取消信号
                onUploadProgress: progressEvent => {
                  if (hasError || isCancelled) return;
                  const percent = Math.round(progressEvent.loaded / progressEvent.total * 100);
                  chunkProgress[chunkIndex] = percent;
                  const totalPercent = Math.round(chunkProgress.reduce((a, b) => a + b, 0) / totalChunks);
                  file.onProgress({
                    percent: totalPercent,
                    file: file.file
                  });
                }
              });
              return; // Success
            } catch (err) {
              // 如果是取消操作，直接返回
              if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                isCancelled = true;
                console.log('分块上传已取消:', file.file.name);
                return;
              }
              retryCount++;
              console.warn(`分块 ${chunkIndex + 1}/${totalChunks} 上传失败 (重试 ${retryCount}/${maxRetries}):`, err);
              if (retryCount >= maxRetries) {
                hasError = true;
                errorMsg = `分块 ${chunkIndex + 1}/${totalChunks} 上传失败: ${err.message}`;
                throw new Error(errorMsg);
              }
              // 等待后重试
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
          }
        };

        // 创建并发池
        const pool = [];
        for (let i = 0; i < maxConcurrency; i++) {
          pool.push((async () => {
            while (nextChunkIndex < totalChunks && !hasError && !isCancelled) {
              const currentIndex = nextChunkIndex++;
              try {
                await uploadChunk(currentIndex);
              } catch (e) {
                if (!isCancelled) {
                  hasError = true;
                  errorMsg = e.message;
                }
                break;
              }
            }
          })());
        }
        await Promise.all(pool);

        // 如果被取消，直接返回
        if (isCancelled) {
          console.log('分块上传已取消，跳过合并步骤');
          return;
        }
        if (hasError) {
          throw new Error(errorMsg || this.$t('uploadForm.uploadError'));
        }

        // 第三步：所有分块上传完成，发送合并请求
        this.$message({
          type: 'info',
          message: this.$t('uploadForm.chunkMerging'),
          duration: 0 // 不自动关闭
        });
        const mergeFormData = new FormData();
        mergeFormData.append('uploadId', uploadId);
        mergeFormData.append('totalChunks', totalChunks.toString());
        mergeFormData.append('originalFileName', file.file.name);
        mergeFormData.append('originalFileType', fileType);
        // HuggingFace 渠道：传递预计算的 SHA256
        if (precomputedSha256) {
          mergeFormData.append('sha256', precomputedSha256);
        }
        const response = await axios({
          url: '/upload' + '?serverCompress=' + needServerCompress + '&uploadChannel=' + uploadChannel + (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') + '&uploadNameType=' + uploadNameType + '&autoRetry=' + autoRetry + '&chunked=true&merge=true',
          method: 'post',
          data: mergeFormData,
          withAuthCode: true
        });

        // 关闭提示
        this.$message.closeAll();

        // 同步处理完成
        file.onSuccess(response, file.file);
      } catch (err) {
        // 如果是取消操作，不加入异常列表
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          console.log('分块上传已取消:', file.file.name);
          return;
        }
        console.error('分块上传失败:', err);

        // 如果有uploadId，清理相关资源
        const fileItem = this.fileList.find(item => item.uid === file.file.uid);
        if (fileItem && fileItem.uploadId) {
          this.cleanupUploadResources(fileItem.uploadId, fileItem.totalChunks).then(() => {
            console.log(`已清理分块上传失败的资源: ${fileItem.uploadId}`);
          }).catch(cleanupError => {
            console.warn('清理分块上传失败资源时出错:', cleanupError);
          });
        }
        if (err.response && err.response.status !== 401) {
          this.exceptionList.push(file);
          file.onError(err, file.file);
        } else if (!err.response) {
          // 网络错误，也加入异常列表
          this.exceptionList.push(file);
          file.onError(err, file.file);
        }
      } finally {
        // 清理 AbortController
        this.abortControllers.delete(file.file.uid);
        // 调用并发控制的完成回调
        this.onUploadComplete();
      }
    },
    handleRemove(file) {
      // 如果文件正在上传，取消上传
      if (this.abortControllers.has(file.uid)) {
        this.abortControllers.get(file.uid).abort();
        this.abortControllers.delete(file.uid);
      }
      // 从上传队列中移除（如果在等待中）
      this.uploadQueue = this.uploadQueue.filter(item => item.file.uid !== file.uid);
      // 从文件列表中移除
      this.fileList = this.fileList.filter(item => item.uid !== file.uid);
      notifyToast(this.$t('uploadForm.deleted', {
        name: this.truncateFilename(file.name)
      }), 'success', 'check-circle');
    },
    // 清理上传资源
    async cleanupUploadResources(uploadId, totalChunks = 0) {
      try {
        await axios({
          url: `/upload?cleanup=true&uploadId=${uploadId}&totalChunks=${totalChunks}`,
          method: 'get',
          withAuthCode: true,
          timeout: 5000
        });
        console.log(`清理上传资源成功: ${uploadId}`);
      } catch (error) {
        console.warn('清理上传资源失败:', error);
      }
    },
    handleSuccess(response, file, options = {}) {
      const fileItem = this.fileList.find(item => item.uid === file.uid);
      if (!fileItem) return; // 文件已被删除

      try {
        // 对上传渠道为外链的，不修改链接
        const uploadChannel = fileItem.uploadChannel || this.uploadChannel;
        if (uploadChannel !== 'external') {
          // 从response.data[0].src中去除/file/前缀
          const srcID = response.data[0].src.replace('/file/', '');
          fileItem.url = `${window.location.protocol}//${window.location.host}/file/` + srcID;
          const urls = buildFileUrls(srcID, file.name, this.rootUrl);
          Object.assign(fileItem, urls);
          fileItem.srcID = srcID;
        }
        fileItem.progreess = 100;
        fileItem.status = 'success';
        window.dispatchEvent(new CustomEvent('imgbed:upload-result', {
          detail: {
            imageUrl: fileItem.url,
            url: getUrlByFormat(fileItem, 'url')
          }
        }));
        this.handleCopy(fileItem, this.selectedUrlForm);

        if (!options.silent) {
          notifyToast(this.$t('uploadForm.uploadSuccess', {
            name: this.truncateFilename(file.name)
          }), 'success', 'check-circle');
        }
        setTimeout(() => {
          const item = this.fileList.find(item => item.uid === file.uid);
          if (item) item.status = 'done';
        }, 1000);
      } catch (error) {
        if (!options.silent) {
          notifyToast(this.$t('uploadForm.uploadFailed', {
            name: this.truncateFilename(file.name)
          }), 'error', 'circle-x');
        }
        fileItem.status = 'exception';
      }
      // 注意：并发控制的 onUploadComplete 已在各上传方法的 finally 中调用
    },
    handleError(err, file, options = {}) {
      const fileItem = this.fileList.find(item => item.uid === file.uid);
      if (!fileItem) return; // 文件已被删除

      const responseData = err?.response?.data;
      const rawReason = typeof responseData === 'string'
        ? responseData
        : responseData?.error || responseData?.message || err?.message || '服务器未返回具体原因';
      const reason = /<\/?(?:html|body|div|table)\b/i.test(rawReason)
        ? `服务器返回异常页面（HTTP ${err?.response?.status || '错误'}），请检查服务配置。`
        : rawReason;
      const failureMessage = `${this.$t('uploadForm.uploadFailed', {
        name: this.truncateFilename(file.name)
      })}：${reason}`;
      if (!options.silent) {
        notifyToast(failureMessage, 'error', 'circle-x');
      }
      fileItem.status = 'exception';

      // 注意：并发控制的 onUploadComplete 已在各上传方法的 finally 中调用
    },
    async handleCopy(file, format = 'url') {
      const status = this.fileList.find(item => item.uid === file.uid)?.status;
      if (status !== 'done' && status !== 'success') {
        notifyToast(this.$t('uploadForm.fileNotUploaded'), 'error', 'circle-x');
        return;
      }
      try {
        await navigator.clipboard.writeText(getUrlByFormat(file, format));
        notifyToast(this.$t('uploadForm.copySuccess'), 'success', 'check-check');
      } catch (error) {
        console.error('Failed to copy uploaded image link:', error);
        notifyToast(this.$t('uploadForm.copyFailed'), 'error', 'circle-x');
      }
    },
    beforeUpload(file) {
      return new Promise(async (resolve, reject) => {
        try {
          const response = await axios.get('/api/channels', { withAuthCode: true });
          const hasConfiguredChannel = Object.values(response.data || {})
            .some((channels) => Array.isArray(channels) && channels.length > 0);
          if (!hasConfiguredChannel) {
            const message = '暂无可用存储，请先在管理面板添加渠道。';
            notifyToast(message, 'error');
            reject(message);
            return;
          }
          const selectedChannels = response.data?.[this.uploadChannel] || [];
          if (this.channelName && !selectedChannels.some((channel) => channel.name === this.channelName)) {
            const message = '未选择有效存储渠道名称，请重新选择后再上传。';
            notifyToast(message, 'error');
            reject(message);
            return;
          }
        } catch (error) {
          // Do not prevent an upload solely because the availability check failed.
          console.warn('Failed to check configured upload channels:', error);
        }

        let processedFile = file;

        // WebP 转换：在压缩之前进行
        // 条件：1.开启WebP转换 2.文件类型为图片 3.不是WebP/GIF/SVG格式
        const canConvertToWebp = this.convertToWebp && file.type.includes('image') && !file.type.includes('webp') && !file.type.includes('gif') && !file.type.includes('svg');
        if (canConvertToWebp) {
          try {
            const convertedFile = await this.convertImageToWebp(file);
            if (convertedFile) {
              processedFile = convertedFile;
              console.log(`WebP转换成功: ${file.name} -> ${convertedFile.name}, 大小: ${(file.size / 1024).toFixed(1)}KB -> ${(convertedFile.size / 1024).toFixed(1)}KB`);
            }
          } catch (err) {
            console.warn('WebP转换失败，使用原文件:', err);
            // 转换失败，继续使用原文件
          }
        }

        // 客户端压缩条件：1.文件类型为图片 2.开启客户端压缩，且文件大小大于压缩阈值
        const needCustomCompress = processedFile.type.includes('image') && this.customerCompress && processedFile.size / 1024 / 1024 > this.compressBar;
        const isLtLim = processedFile.size / 1024 / 1024 <= 1024 || this.uploadChannel !== 'telegram';
        const pushFileToQueue = (file, serverCompress) => {
          const fileUrl = URL.createObjectURL(file);
          this.fileList.push({
            uid: file.uid,
            name: file.name,
            url: fileUrl,
            finalURL: '',
            mdURL: '',
            htmlURL: '',
            ubbURL: '',
            srcID: '',
            status: 'uploading',
            progreess: 0,
            serverCompress: serverCompress,
            retryCount: 0
          });
          resolve(file);
        };
        if (needCustomCompress) {
          //尝试压缩图片
          imageConversion.compressAccurately(processedFile, 1024 * this.compressQuality).then(res => {
            //如果压缩后大于1024MB，且上传渠道为telegram，则不上传
            if (res.size / 1024 / 1024 > 1024 && this.uploadChannel === 'telegram') {
              notifyToast(this.$t('uploadForm.compressedFileTooLarge', {
                name: processedFile.name
              }), 'error');
              reject(this.$t('uploadForm.fileSizeTooLarge'));
            }
            this.uploading = true;
            //将res包装成新的file
            const newFile = new File([res], processedFile.name, {
              type: res.type
            });
            newFile.uid = file.uid;
            const myUploadCount = this.uploadCount++;

            //开启服务端压缩条件：1.开启服务端压缩 2.文件大小小于10MB 3.上传渠道为Telegram
            const needServerCompress = this.serverCompress && newFile.size / 1024 / 1024 < 10 && this.uploadChannel === 'telegram';
            if (myUploadCount === 0) {
              pushFileToQueue(newFile, needServerCompress);
            } else {
              setTimeout(() => {
                pushFileToQueue(newFile, needServerCompress);
                this.uploadCount--;
              }, 300 * myUploadCount);
            }
          }).catch(err => {
            notifyToast(this.$t('uploadForm.compressFailedCannotUpload', {
              name: processedFile.name
            }), 'error');
            reject(err);
          });
        } else if (isLtLim) {
          this.uploading = true;
          const myUploadCount = this.uploadCount++;

          // 开启服务端压缩条件：1.上传渠道为Telegram 2.开启服务端压缩 3.如果为图片，则文件大小小于10MB，否则不限制大小
          const needServerCompress = this.uploadChannel === 'telegram' && this.serverCompress && (processedFile.type.includes('image') ? processedFile.size / 1024 / 1024 < 10 : true);
          if (myUploadCount === 0) {
            pushFileToQueue(processedFile, needServerCompress);
          } else {
            setTimeout(() => {
              pushFileToQueue(processedFile, needServerCompress);
              this.uploadCount--;
            }, 300 * myUploadCount);
          }
        } else {
          notifyToast(this.$t('uploadForm.fileTooLarge', {
            name: processedFile.name
          }), 'error');
          reject(this.$t('uploadForm.fileSizeTooLarge'));
        }
      });
    },
    handleProgress(event) {
      const fileItem = this.fileList.find(item => item.uid === event.file.uid);
      if (fileItem) {
        fileItem.progreess = event.percent;
      }
    },
    handlePaste(event) {
      // 当粘贴位置是文本框时，不执行该操作
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      const items = event.clipboardData?.items;
      if (items?.length > 0) {
        const imageCount = Array.from(items).filter(item => {
          return item.kind === 'file' && item.type.startsWith('image/') && item.getAsFile();
        }).length;
        if (imageCount === 0) {
          this.uploadFromUrl(items);
          return;
        }
        const batch = {
          total: imageCount,
          completed: 0,
          failed: false,
          failureMessage: '',
          failureIcon: ''
        };
        this.clipboardPasteBatch = batch;
        notifyToast(
          imageCount > 1
            ? this.$t('uploadForm.pasteUploadingProgress', { current: 1, total: imageCount })
            : this.$t('uploadForm.pasteUploading'),
          'success',
          'loader-circle'
        );
        this.uploadFromUrl(items, batch);
      }
    },
    finishClipboardUpload(batch, success, error = null) {
      if (!batch || batch.completed >= batch.total) return;
      if (!success) {
        batch.failed = true;
        const reason = String(error?.message || error || '');
        if (/too large|file size|文件过大|超出大小/i.test(reason)) {
          batch.failureMessage = this.$t('uploadForm.pasteFileTooLarge');
          batch.failureIcon = 'file-warning';
        } else if (/unsupported|not supported|format|格式不支持/i.test(reason)) {
          batch.failureMessage = this.$t('uploadForm.pasteUnsupportedFormat');
          batch.failureIcon = 'file-warning';
        }
      }
      batch.completed += 1;
      if (batch.completed < batch.total) {
        notifyToast(
          this.$t('uploadForm.pasteUploadingProgress', {
            current: batch.completed + 1,
            total: batch.total
          }),
          'success',
          'loader-circle'
        );
        return;
      }
      if (this.clipboardPasteBatch === batch) this.clipboardPasteBatch = null;
      if (batch.failed) {
        notifyToast(batch.failureMessage || this.$t('uploadForm.pasteUploadFailed'), 'error', batch.failureIcon || 'circle-x');
      } else {
        notifyToast(this.$t('uploadForm.pasteUploadSuccess'), 'success', 'check-circle');
      }
    },
    handleUploadPasteUrls() {
      // 用于上传在上传文本框中粘贴的外链
      const urls = this.pastedUrls.split('\n');
      // 处理空行和首尾空字符，链接须符合URL规范
      const validUrls = urls.map(url => url.trim()).filter(url => url !== '').filter(url => /^(https?:\/\/[^\s$.?#].[^\s]*)$/.test(url));

      // 根据粘贴上传方式进行上传
      if (this.pasteUploadMethod === 'save') {
        // 正常上传
        this.uploadFromUrl(validUrls.map(url => {
          return {
            kind: 'string',
            getAsString: callback => {
              callback(url);
            }
          };
        }));
      } else if (this.pasteUploadMethod === 'external') {
        // 仅保存外链，使用 external 渠道上传
        for (let i = 0; i < validUrls.length; i++) {
          const url = validUrls[i];
          const fileName = url.split('/').pop();
          const mdUrl = `![${fileName}](${url})`;
          const htmlUrl = `<img src="${url}" alt="${fileName}" width=100% />`;
          const ubbUrl = `[img]${url}[/img]`;
          // 将 url 作为文件内容，文件名为 URL 的最后一部分
          const file = new File([], url.split('/').pop(), {
            type: 'text/plain'
          });
          file.uid = Date.now() + i;
          file.url = url;
          this.fileList.push({
            uid: file.uid,
            name: file.name,
            url: url,
            finalURL: url,
            mdURL: mdUrl,
            htmlURL: htmlUrl,
            ubbURL: ubbUrl,
            srcID: url,
            status: 'uploading',
            progreess: 0,
            serverCompress: false,
            uploadChannel: 'external',
            retryCount: 0
          });
          // 上传
          this.uploadFile({
            file: file,
            onProgress: evt => this.handleProgress(evt),
            onSuccess: (response, file) => this.handleSuccess(response, file),
            onError: (error, file) => this.handleError(error, file)
          });
        }
      }
    },
    uploadFromUrl(items, clipboardBatch = null) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (!file) continue;
          const isClipboardImage = clipboardBatch && file.type.startsWith('image/');
          let clipboardItemFinished = false;
          const finishClipboardItem = (success, error = null) => {
            if (!isClipboardImage || clipboardItemFinished) return;
            clipboardItemFinished = true;
            this.finishClipboardUpload(clipboardBatch, success, error);
          };
          // 允许上传任意类型的文件
          file.uid = Date.now() + i;
          //接收beforeUpload的Promise对象
          const checkResult = this.beforeUpload(file);
          if (checkResult instanceof Promise) {
            checkResult.then(newFile => {
              if (newFile instanceof File) {
                this.uploadFile({
                  file: newFile,
                  onProgress: evt => this.handleProgress(evt),
                  onSuccess: (response, file) => {
                    this.handleSuccess(response, file, { silent: Boolean(isClipboardImage) });
                    const uploadedFile = this.fileList.find(item => item.uid === file.uid);
                    finishClipboardItem(uploadedFile?.status === 'done' || uploadedFile?.status === 'success');
                  },
                  onError: (error, file) => {
                    this.handleError(error, file, { silent: Boolean(isClipboardImage) });
                    finishClipboardItem(false, error);
                  }
                });
                const uploadItem = this.fileList.find(item => item.uid === newFile.uid);
                if (uploadItem?.status === 'exception') {
                  finishClipboardItem(false);
                }
              } else {
                finishClipboardItem(false);
              }
            }).catch(err => {
              finishClipboardItem(false, err);
              console.log(err);
            });
          } else {
            finishClipboardItem(false);
          }
        } else if (items[i].kind === 'string') {
          items[i].getAsString(text => {
            const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/;
            let fileName = '';
            if (urlPattern.test(text)) {
              axios.post('/api/fetchRes', {
                url: text
              }, {
                responseType: 'blob',
                withAuthCode: true
              }).then(response => {
                const contentType = response.headers['content-type'];
                if (response.status == 200) {
                  // 提取文件名
                  const disposition = response.headers['content-disposition'];
                  if (disposition) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const filenameStarRegex = /filename\*\s*=\s*UTF-8''([^;\n]*)/; // 处理 filename*

                    let matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                      fileName = matches[1].replace(/['"]/g, '');
                      // 尝试解码
                      try {
                        fileName = decodeURIComponent(fileName);
                      } catch (e) {
                        fileName = '';
                      }
                    }
                    if (fileName === '') {
                      matches = filenameStarRegex.exec(disposition); // 尝试匹配 filename*
                      if (matches != null && matches[1]) {
                        fileName = decodeURIComponent(matches[1]);
                      }
                    }
                  }
                  // 尝试从URL中提取文件名
                  if (fileName === '') {
                    const url = new URL(text);
                    fileName = url.pathname.split('/').pop();
                  }
                  // 未提取到文件名，使用默认文件名
                  if (fileName === '') {
                    // 获取文件后缀
                    const url = new URL(text);
                    let extension = url.pathname.split('.').pop();
                    // 未能从URL提取有效后缀，使用bin作为默认后缀
                    if (!extension || extension === '' || extension.length > 10) {
                      extension = 'bin';
                    }
                    fileName = 'PastedFile' + Date.now() + i + '.' + extension;
                  }

                  // 读取文件内容
                  const blob = response.data;
                  const file = new File([blob], fileName, {
                    type: blob.type
                  });
                  file.uid = Date.now() + i;
                  // 接收beforeUpload的Promise对象
                  const checkResult = this.beforeUpload(file);
                  if (checkResult instanceof Promise) {
                    checkResult.then(newFile => {
                      if (newFile instanceof File) {
                        this.uploadFile({
                          file: newFile,
                          onProgress: evt => this.handleProgress(evt),
                          onSuccess: (response, file) => this.handleSuccess(response, file),
                          onError: (error, file) => this.handleError(error, file)
                        });
                      }
                    }).catch(err => {
                      console.log(err);
                    });
                  }
                } else {
                  throw new Error('URL地址请求失败');
                }
              }).catch(error => {
                this.$message({
                  type: 'warning',
                  message: this.$t('uploadForm.urlRequestFailed')
                });
              });
            }
          });
        }
      }
    },
    handleScroll(event) {
      this.listScrolled = event.scrollTop > 0 && this.fileList.length > 0;
    },
    retryError() {
      if (this.exceptionList.length > 0) {
        this.retryFailedFiles(this.exceptionList);
        this.exceptionList = [];
      } else {
        this.$message({
          type: 'info',
          message: this.$t('uploadForm.noFailedFiles')
        });
      }
    },
    handleAutoRetryChange(val) {
      this.$message({
        type: val ? 'success' : 'info',
        message: val ? this.$t('uploadForm.autoRetryOn') : this.$t('uploadForm.autoRetryOff')
      });

      // 如果开启自动重试且有失败文件，立即开始重试
      if (val && this.exceptionList.length > 0) {
        this.scheduleAutoRetry();
      }
    },
    retryFailedFiles(files) {
      files.forEach(file => {
        const retryCount = file.retryCount || 0;
        if (retryCount < this.maxRetryCount) {
          file.retryCount = retryCount + 1;
          this.uploadFile({
            file: file.file,
            onProgress: evt => this.handleProgress(evt),
            onSuccess: (response, file) => this.handleSuccess(response, file),
            onError: (error, file) => this.handleError(error, file)
          });
        } else {
          this.$message({
            type: 'warning',
            message: this.$t('uploadForm.maxRetryReached', {
              name: file.name,
              max: this.maxRetryCount
            })
          });
        }
      });
    },
    scheduleAutoRetry() {
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
      }
      this.retryTimer = setTimeout(() => {
        if (this.autoReUpload && this.exceptionList.length > 0) {
          const filesToRetry = [...this.exceptionList];
          this.exceptionList = [];
          this.retryFailedFiles(filesToRetry);
        }
      }, this.retryDelay);
    },
    // HuggingFace 大文件直传（绕过 CF Workers 限制）
    // 流程：前端计算 SHA256 → 获取 S3 上传 URL → 直传到 S3 → 提交文件引用
    async uploadToHuggingFaceDirect(file) {
      const fileItem = this.fileList.find(item => item.uid === file.file.uid);
      if (!fileItem) return;

      // 创建 AbortController 用于取消上传
      const abortController = new AbortController();
      this.abortControllers.set(file.file.uid, abortController);
      try {
        console.log('=== HuggingFace Direct Upload ===');
        console.log('File:', file.file.name, 'Size:', file.file.size);

        // 1. 计算 SHA256
        file.onProgress({
          percent: 5,
          file: file.file
        });
        console.log('Computing SHA256...');
        const sha256 = await computeSha256(file.file);
        console.log('SHA256:', sha256);

        // 检查是否已取消
        if (abortController.signal.aborted) {
          console.log('HuggingFace 上传已取消:', file.file.name);
          return;
        }

        // 2. 获取文件样本（前512字节的base64）
        const sampleBytes = new Uint8Array(await file.file.slice(0, 512).arrayBuffer());
        const fileSample = btoa(String.fromCharCode(...sampleBytes));

        // 3. 获取 LFS 上传 URL
        file.onProgress({
          percent: 10,
          file: file.file
        });
        console.log('Getting LFS upload URL...');
        const uploadInfoRes = await axios({
          url: '/upload/huggingface/getUploadUrl',
          method: 'post',
          data: {
            fileSize: file.file.size,
            fileName: file.file.name,
            fileType: file.file.type,
            sha256,
            fileSample,
            channelName: this.channelName,
            // 传递指定的渠道名称
            uploadNameType: this.uploadNameType
          },
          withAuthCode: true,
          signal: abortController.signal
        });
        if (!uploadInfoRes.data.success) {
          throw new Error(uploadInfoRes.data.error || 'Failed to get upload URL');
        }
        const uploadInfo = uploadInfoRes.data;
        console.log('Upload info:', uploadInfo);

        // 检查文件是否已存在
        if (uploadInfo.alreadyExists) {
          console.log('File already exists in LFS, skipping upload');
          file.onProgress({
            percent: 90,
            file: file.file
          });
        } else if (uploadInfo.needsLfs && uploadInfo.uploadAction) {
          // 4. 直接上传到 S3
          const {
            href,
            header
          } = uploadInfo.uploadAction;
          if (header?.chunk_size) {
            // 分片上传
            await this.uploadToHuggingFaceMultipart(file, uploadInfo, abortController);
          } else {
            // 基本上传
            console.log('Uploading to S3 (basic)...');
            const uploadRes = await fetch(href, {
              method: 'PUT',
              headers: header || {},
              body: file.file,
              signal: abortController.signal
            });
            if (!uploadRes.ok) {
              const error = await uploadRes.text();
              throw new Error(`S3 upload failed: ${uploadRes.status} - ${error}`);
            }
            console.log('S3 upload complete');
          }
        }

        // 检查是否已取消
        if (abortController.signal.aborted) {
          console.log('HuggingFace 上传已取消:', file.file.name);
          return;
        }

        // 5. 提交文件引用
        file.onProgress({
          percent: 95,
          file: file.file
        });
        console.log('Committing file...');
        const commitRes = await axios({
          url: '/upload/huggingface/commitUpload',
          method: 'post',
          data: {
            fullId: uploadInfo.fullId,
            filePath: uploadInfo.filePath,
            sha256,
            fileSize: file.file.size,
            fileName: file.file.name,
            fileType: file.file.type,
            channelName: uploadInfo.channelName
          },
          withAuthCode: true,
          signal: abortController.signal
        });
        if (!commitRes.data.success) {
          throw new Error(commitRes.data.error || 'Failed to commit file');
        }
        console.log('Upload complete:', commitRes.data);
        // 转换响应格式以匹配 handleSuccess 期望的格式
        const formattedResponse = {
          data: [{
            src: commitRes.data.src
          }]
        };
        file.onSuccess(formattedResponse, file.file);
      } catch (err) {
        // 如果是取消操作，不加入异常列表
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.name === 'AbortError') {
          console.log('HuggingFace 上传已取消:', file.file.name);
          return;
        }
        console.error('HuggingFace direct upload error:', err);
        this.exceptionList.push(file);
        file.onError(err, file.file);
      } finally {
        // 清理 AbortController
        this.abortControllers.delete(file.file.uid);
        // 调用并发控制的完成回调
        this.onUploadComplete();
      }
    },
    // HuggingFace 分片上传到 S3
    async uploadToHuggingFaceMultipart(file, uploadInfo, abortController) {
      const {
        uploadAction
      } = uploadInfo;
      const {
        href: completionUrl,
        header
      } = uploadAction;
      const chunkSize = parseInt(header.chunk_size);

      // 获取所有分片的上传 URL
      const parts = Object.keys(header).filter(key => /^[0-9]+$/.test(key));
      console.log(`Multipart upload: ${parts.length} parts, chunk size: ${chunkSize}`);
      const completeParts = [];
      const totalParts = parts.length;
      for (const part of parts) {
        // 检查是否已取消
        if (abortController && abortController.signal.aborted) {
          console.log('HuggingFace 分片上传已取消');
          throw new DOMException('Upload cancelled', 'AbortError');
        }
        const index = parseInt(part) - 1;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.file.size);
        const chunk = file.file.slice(start, end);
        console.log(`Uploading part ${part}/${totalParts}`);
        const response = await fetch(header[part], {
          method: 'PUT',
          body: chunk,
          signal: abortController ? abortController.signal : undefined
        });
        if (!response.ok) {
          throw new Error(`Failed to upload part ${part}: ${response.status}`);
        }
        const etag = response.headers.get('ETag');
        if (!etag) {
          throw new Error(`No ETag for part ${part}`);
        }
        completeParts.push({
          partNumber: parseInt(part),
          etag
        });

        // 更新进度（10% - 90%）
        const progress = 10 + Math.round(parseInt(part) / totalParts * 80);
        file.onProgress({
          percent: progress,
          file: file.file
        });
      }

      // 检查是否已取消
      if (abortController && abortController.signal.aborted) {
        console.log('HuggingFace 分片上传已取消');
        throw new DOMException('Upload cancelled', 'AbortError');
      }

      // 完成分片上传
      console.log('Completing multipart upload...');
      const completeResponse = await fetch(completionUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.git-lfs+json',
          'Content-Type': 'application/vnd.git-lfs+json'
        },
        body: JSON.stringify({
          oid: uploadInfo.oid,
          parts: completeParts
        }),
        signal: abortController ? abortController.signal : undefined
      });
      if (!completeResponse.ok) {
        const error = await completeResponse.text();
        throw new Error(`Multipart complete failed: ${completeResponse.status} - ${error}`);
      }
      console.log('Multipart upload complete');
    },
    // 将图片转换为 WebP 格式
    async convertImageToWebp(file) {
      return new Promise((resolve, reject) => {
        // 不支持转换的格式直接返回 null
        if (file.type.includes('gif') || file.type.includes('svg') || file.type.includes('webp')) {
          resolve(null);
          return;
        }
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => {
            if (blob) {
              // 修改文件名：将原扩展名替换为 .webp
              const originalName = file.name;
              const lastDotIndex = originalName.lastIndexOf('.');
              const newName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) + '.webp' : originalName + '.webp';
              const webpFile = new File([blob], newName, {
                type: 'image/webp'
              });
              webpFile.uid = file.uid;
              resolve(webpFile);
            } else {
              reject(new Error('WebP 转换失败'));
            }

            // 清理
            URL.revokeObjectURL(img.src);
          }, 'image/webp', 0.92); // 0.92 质量参数，平衡质量和大小
        };
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          reject(new Error(this.$t('uploadForm.imageLoadFailed')));
        };
        img.src = URL.createObjectURL(file);
      });
    },
    // 拖拽上传卡片鼠标移动事件 - 悬浮光斑效果
    handleUploadCardMouseMove(e) {
      const glow = this.$refs.uploadCardGlow;
      if (!glow) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.opacity = '1';
      glow.style.left = x + 'px';
      glow.style.top = y + 'px';
    },
    // 拖拽上传卡片鼠标离开事件
    handleUploadCardMouseLeave() {
      const glow = this.$refs.uploadCardGlow;
      if (!glow) return;
      glow.style.opacity = '0';
    }
  },
  beforeDestroy() {
    // 清理定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }
};
