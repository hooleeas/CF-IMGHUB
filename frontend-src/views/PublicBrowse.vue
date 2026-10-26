import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.filter.js";
import "core-js/modules/es.iterator.for-each.js";
import "core-js/modules/es.iterator.map.js";
import axios from 'axios';
import { mapGetters } from 'vuex';
import TransformMedia from '@/components/browse/TransformMedia.vue';
import { hardStopAll, installGlobalMediaGuards } from '@/utils/mediaManager';
export default {
  name: 'PublicBrowse',
  components: {
    TransformMedia
  },
  data() {
    return {
      files: [],
      allowedDirs: [],
      rootDir: '',
      currentPath: '',
      totalCount: 0,
      loading: false,
      error: null,
      canRetry: true,
      hasMore: true,
      previewVisible: false,
      previewIndex: 0,
      observer: null,
      pageSize: 24,
      searchInput: '',
      searchKeyword: '',
      currentStartIndex: 0,
      searchExpanded: false,
      filterType: '',
      lastScrollY: 0,
      scrollPage: 0,
      columnCount: 4,
      columnHeights: [0, 0, 0, 0],
      // 桌面端旋转和缩放
      imageRotation: 0,
      imageScale: 1,
      // 桌面端拖拽
      imageTx: 0,
      imageTy: 0,
      imageDragging: false,
      imageDragStart: null,
      imageStartTx: 0,
      imageStartTy: 0,
      // 手机端滑动
      swipeX: 0,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeStartT: 0,
      swipeActive: false,
      swipeAnimating: false,
      swipeDir: 0,
      viewportW: 0,
      // 手势锁定（子组件缩放/旋转时锁住轮播）
      gestureLocked: false,
      // 音频滑动切换
      audioSwipeStartX: 0,
      audioSwipeStartT: 0,
      audioSwipeActive: false,
      // 设备类型判断（用 JS 而非纯 CSS，避免全屏时媒体查询失效）
      isMobile: false
    };
  },
  computed: {
    ...mapGetters(['userConfig']),
    siteName() {
      return 'cf-imghub';
    },
    rootDirName() {
      return this.rootDir.split('/').filter(Boolean).pop() || this.$t('publicBrowse.rootDirectory');
    },
    pathParts() {
      if (!this.currentPath || !this.rootDir) return [];
      const relative = this.currentPath.replace(this.rootDir, '').replace(/^\/+/, '');
      return relative.split('/').filter(Boolean);
    },
    folders() {
      return this.files.filter(f => f.isFolder);
    },
    mediaFiles() {
      return this.files.filter(f => !f.isFolder);
    },
    totalPages() {
      return Math.ceil(this.totalCount / this.pageSize);
    },
    displayCurrentPage() {
      // 基于滚动位置计算当前页码
      const startPage = Math.floor(this.currentStartIndex / this.pageSize) + 1;
      const loadedPages = Math.ceil(this.mediaFiles.length / this.pageSize);
      // 根据滚动比例计算当前在第几页
      return Math.min(startPage + Math.floor(this.scrollPage * loadedPages), this.totalPages);
    },
    columns() {
      const cols = Array.from({
        length: this.columnCount
      }, () => []);
      for (const file of this.mediaFiles) {
        const idx = file.columnIndex ?? 0;
        if (idx < this.columnCount) {
          cols[idx].push(file);
        } else {
          cols[0].push(file);
        }
      }
      return cols;
    },
    currentPreviewFile() {
      return this.mediaFiles[this.previewIndex];
    },
    prevPreviewFile() {
      return this.previewIndex > 0 ? this.mediaFiles[this.previewIndex - 1] : null;
    },
    nextPreviewFile() {
      return this.previewIndex < this.mediaFiles.length - 1 ? this.mediaFiles[this.previewIndex + 1] : null;
    },
    desktopImageStyle() {
      const inDrag = this.imageDragging;
      return {
        transform: `translate(${this.imageTx}px, ${this.imageTy}px) rotate(${this.imageRotation}deg) scale(${this.imageScale})`,
        transition: inDrag ? 'none' : 'transform 0.3s ease',
        cursor: this.imageScale > 1 ? this.imageDragging ? 'grabbing' : 'grab' : 'default'
      };
    },
    swipeWindow() {
      return [this.prevPreviewFile, this.currentPreviewFile, this.nextPreviewFile];
    },
    swipeTrackStyle() {
      // 默认停在中间那页（-viewportW）
      const base = -this.viewportW;
      const x = base + this.swipeX;
      return {
        transform: `translate3d(${x}px, 0, 0)`,
        transition: this.swipeAnimating ? 'transform 0.28s ease' : 'none'
      };
    }
  },
  watch: {
    '$route.params.dir': {
      handler() {
        this.initFromRoute();
      }
    }
  },
  mounted() {
    // 安装全局媒体守卫
    installGlobalMediaGuards();
    this.checkMobile();
    this.initFromRoute();
    this.setupIntersectionObserver();
    this.updateColumnCount();
    window.addEventListener('resize', this.updateColumnCount);
    window.addEventListener('resize', this.checkMobile);
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
    window.removeEventListener('resize', this.updateColumnCount);
    window.removeEventListener('resize', this.checkMobile);
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    // 搜索处理
    handleSearch() {
      const input = this.searchInput.trim();
      if (!input) {
        // 清空搜索，重置
        this.searchKeyword = '';
        this.filterType = '';
        this.currentStartIndex = 0;
        this.resetAndLoad();
        return;
      }

      // 检查是否是页码跳转 #数字
      const pageMatch = input.match(/^#(\d+)$/);
      if (pageMatch) {
        const page = parseInt(pageMatch[1], 10);
        const maxPage = Math.ceil(this.totalCount / this.pageSize);
        const targetPage = Math.min(Math.max(1, page), maxPage || 1);
        this.currentStartIndex = (targetPage - 1) * this.pageSize;
        this.searchKeyword = '';
        this.filterType = '';
        this.searchInput = '';
        this.resetAndLoad();
        return;
      }

      // 检查是否是类型关键词
      const typeKeywords = {
        '图片': 'image',
        '图': 'image',
        'image': 'image',
        'img': 'image',
        '照片': 'image',
        '视频': 'video',
        'video': 'video',
        '影片': 'video',
        '电影': 'video',
        '音乐': 'audio',
        '音频': 'audio',
        'audio': 'audio',
        'music': 'audio',
        '歌曲': 'audio'
      };
      const lowerInput = input.toLowerCase();
      if (typeKeywords[lowerInput]) {
        this.filterType = typeKeywords[lowerInput];
        this.searchKeyword = '';
        this.currentStartIndex = 0;
        this.resetAndLoad();
        return;
      }

      // 普通文件名搜索
      this.filterType = '';
      this.searchKeyword = input;
      this.currentStartIndex = 0;
      this.resetAndLoad();
    },
    // 重置并加载
    resetAndLoad() {
      this.files = [];
      this.hasMore = true;
      this.columnHeights = new Array(this.columnCount).fill(0);
      this.loadFiles().then(() => {
        // 重新观察加载触发器，确保无限滚动继续工作
        this.observeLoadTrigger();
      });
    },
    // 搜索框展开/收起
    toggleSearch() {
      this.searchExpanded = !this.searchExpanded;
      if (this.searchExpanded) {
        this.$nextTick(() => {
          this.$refs.searchInputRef?.focus();
        });
      }
    },
    // 监听滚动收起搜索框 + 计算当前页码
    handleScroll() {
      const currentScrollY = window.scrollY;

      // 收起搜索框
      if (this.searchExpanded) {
        if (currentScrollY > this.lastScrollY + 20) {
          this.searchExpanded = false;
        }
      }
      this.lastScrollY = currentScrollY;

      // 计算滚动页码比例
      const gallery = this.$refs.galleryContainer;
      if (gallery && this.mediaFiles.length > 0) {
        const galleryRect = gallery.getBoundingClientRect();
        const galleryTop = gallery.offsetTop;
        const scrollableHeight = gallery.scrollHeight - window.innerHeight;
        if (scrollableHeight > 0) {
          const scrolled = Math.max(0, currentScrollY - galleryTop);
          this.scrollPage = Math.min(1, scrolled / scrollableHeight);
        } else {
          this.scrollPage = 0;
        }
      }
    },
    // 检测是否为移动设备（用 JS 判断，避免全屏时 CSS 媒体查询失效）
    checkMobile() {
      // 只有屏幕宽度 ≤600px 才算手机端（与瀑布流2列的断点一致）
      // 不用 pointer: coarse，因为很多电脑也有触摸屏
      this.isMobile = window.innerWidth <= 600;
    },
    // 生成 slide key，切换时让子组件重新挂载以重置 transform
    getSlideKey(f, i) {
      if (!f) return `empty-${i}`;
      // 中间那张用 previewIndex 作为 key 的一部分，确保切换时重新挂载
      if (i === 1) return `${f.name}-${this.previewIndex}`;
      return f.name;
    },
    updateColumnCount() {
      const width = window.innerWidth;
      let newCount;
      if (width < 600) {
        newCount = 2;
      } else if (width < 900) {
        newCount = 3;
      } else {
        newCount = 4;
      }
      if (newCount !== this.columnCount) {
        this.columnCount = newCount;
        this.columnHeights = new Array(this.columnCount).fill(0);
        this.mediaFiles.forEach(f => {
          f.columnIndex = undefined;
          this.assignToColumn(f);
        });
      }
    },
    getShortestColumn() {
      let minIndex = 0;
      let minHeight = this.columnHeights[0];
      for (let i = 1; i < this.columnCount; i++) {
        if (this.columnHeights[i] < minHeight) {
          minHeight = this.columnHeights[i];
          minIndex = i;
        }
      }
      return minIndex;
    },
    assignToColumn(file, height = 200) {
      const colIndex = this.getShortestColumn();
      file.columnIndex = colIndex;
      this.columnHeights[colIndex] += height;
      // 音频和其他文件直接标记为已加载（没有 load 事件）
      if (this.isAudio(file) || !this.isImage(file) && !this.isVideo(file)) {
        file.loaded = true;
      }
    },
    onImageLoad(event, file) {
      const img = event.target;
      const ratio = img.naturalHeight / img.naturalWidth;
      const height = 280 * ratio;
      if (file.columnIndex === undefined) {
        this.assignToColumn(file, height);
      }
      file.loaded = true;
    },
    onVideoLoad(event, file) {
      const video = event.target;
      const ratio = video.videoHeight / video.videoWidth;
      const height = 280 * ratio;
      if (file.columnIndex === undefined) {
        this.assignToColumn(file, height);
      }
      file.loaded = true;
    },
    setupIntersectionObserver() {
      this.observer = new IntersectionObserver(entries => {
        const entry = entries[0];
        if (entry.isIntersecting && this.hasMore && !this.loading) {
          this.loadMore();
        }
      }, {
        rootMargin: '200px'
      });
    },
    observeLoadTrigger() {
      this.$nextTick(() => {
        if (this.$refs.loadTrigger && this.observer) {
          this.observer.observe(this.$refs.loadTrigger);
        }
      });
    },
    async initFromRoute() {
      const dirParam = this.$route.params.dir || '';
      const dirPath = Array.isArray(dirParam) ? dirParam.join('/') : dirParam;

      // 支持根目录访问（dirPath 可以为空）
      const parts = dirPath.split('/').filter(Boolean);
      this.rootDir = parts[0] || '';
      this.currentPath = dirPath;
      this.files = [];
      this.hasMore = true;
      this.columnHeights = new Array(this.columnCount).fill(0);
      // 重置搜索状态
      this.searchInput = '';
      this.searchKeyword = '';
      this.filterType = '';
      this.currentStartIndex = 0;
      await this.loadFiles();
      this.observeLoadTrigger();
    },
    async loadFiles() {
      this.loading = true;
      this.error = null;
      this.canRetry = true;
      try {
        let url = `/api/public/list?dir=${encodeURIComponent(this.currentPath)}&start=${this.currentStartIndex}&count=${this.pageSize}`;
        if (this.searchKeyword) {
          url += `&search=${encodeURIComponent(this.searchKeyword)}`;
        }
        if (this.filterType) {
          url += `&type=${this.filterType}`;
        }
        const res = await axios.get(url);
        if (res.data.allowedDirs) {
          this.allowedDirs = res.data.allowedDirs;
        }
        const dirs = (res.data.directories || []).map(d => ({
          name: d,
          isFolder: true
        }));
        const files = (res.data.files || []).map(f => ({
          name: f.name,
          isFolder: false,
          metadata: f.metadata,
          columnIndex: undefined
        }));
        files.forEach(f => this.assignToColumn(f));
        this.files = [...dirs, ...files];
        this.totalCount = res.data.totalCount || this.files.length;
        this.hasMore = this.currentStartIndex + this.mediaFiles.length < this.totalCount;
      } catch (err) {
        if (err.response?.status === 403) {
          const msg = err.response?.data?.error || '';
          if (msg.includes('disabled')) {
            this.error = this.$t('publicBrowse.browseDisabled');
          } else if (msg.includes('not allowed') || msg.includes('No public')) {
            this.error = this.$t('publicBrowse.directoryNotAllowed');
          } else {
            this.error = this.$t('publicBrowse.accessDenied');
          }
          this.canRetry = false;
        } else {
          this.error = this.$t('publicBrowse.loadFailed');
        }
      } finally {
        this.loading = false;
      }
    },
    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      try {
        const start = this.currentStartIndex + this.mediaFiles.length;
        let url = `/api/public/list?dir=${encodeURIComponent(this.currentPath)}&start=${start}&count=${this.pageSize}`;
        if (this.searchKeyword) {
          url += `&search=${encodeURIComponent(this.searchKeyword)}`;
        }
        if (this.filterType) {
          url += `&type=${this.filterType}`;
        }
        const res = await axios.get(url);
        const moreFiles = (res.data.files || []).map(f => ({
          name: f.name,
          isFolder: false,
          metadata: f.metadata,
          columnIndex: undefined
        }));
        moreFiles.forEach(f => this.assignToColumn(f));
        this.files.push(...moreFiles);
        this.hasMore = this.currentStartIndex + this.mediaFiles.length < this.totalCount;
      } catch (err) {
        console.error('加载更多失败', err);
      } finally {
        this.loading = false;
      }
    },
    enterFolder(folderPath) {
      const newPath = folderPath.replace(/\/+$/, '');
      this.$router.push(`/browse/${newPath}`);
    },
    goToRoot() {
      this.$router.push(`/browse/${this.rootDir}`);
    },
    goToPath(index) {
      const parts = this.pathParts.slice(0, index + 1);
      const newPath = this.rootDir + (parts.length ? '/' + parts.join('/') : '');
      this.$router.push(`/browse/${newPath}`);
    },
    getFolderName(path) {
      return path.split('/').filter(Boolean).pop() || path;
    },
    getFileUrl(name) {
      return `${window.location.origin}/file/${encodeURI(name)}`;
    },
    isImage(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext);
    },
    isVideo(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      // 浏览器原生支持的视频格式 + 部分浏览器支持的格式
      return ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi', '3gp', 'mpeg', 'mpg'].includes(ext);
    },
    isAudio(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'ape', 'opus'].includes(ext);
    },
    getFileName(name) {
      return name.split('/').pop();
    },
    handleImageError(e) {
      const img = e.target;
      const retryCount = parseInt(img.dataset.retryCount || '0');
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        // 重试：添加时间戳避免缓存
        img.dataset.retryCount = retryCount + 1;
        const originalSrc = img.src.split('?_retry=')[0];
        setTimeout(() => {
          img.src = originalSrc + '?_retry=' + Date.now();
        }, 500 * (retryCount + 1));
      } else {
        // 重试次数用完，隐藏图片
        img.style.display = 'none';
      }
    },
    copyLink(name) {
      const url = this.getFileUrl(name);
      navigator.clipboard?.writeText(url).then(() => {
        this.showToast(this.$t('publicBrowse.copied'));
      }).catch(() => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        this.showToast(this.$t('publicBrowse.copied'));
      });
    },
    showToast(msg) {
      const existing = document.querySelector('.copy-toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 1500);
    },
    downloadFile(name) {
      const link = document.createElement('a');
      link.href = this.getFileUrl(name);
      link.download = name.split('/').pop();
      link.click();
    },
    openPreview(file) {
      if (file.isFolder) return;
      // 打开预览前先硬停全站（防止瀑布流 hover video 或旧实例残留）
      hardStopAll(null);
      const mediaIndex = this.mediaFiles.findIndex(f => f.name === file.name);
      if (mediaIndex >= 0) {
        this.previewIndex = mediaIndex;
        this.previewVisible = true;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
        this.gestureLocked = false;
        document.body.style.overflow = 'hidden';
        this.$nextTick(() => {
          this.viewportW = this.$refs.mobileViewport?.getBoundingClientRect().width || window.innerWidth;
        });
      }
    },
    closePreview() {
      // 关闭预览先硬停全站，再关弹窗
      hardStopAll(null);
      this.previewVisible = false;
      this.imageRotation = 0;
      this.imageScale = 1;
      this.imageTx = 0;
      this.imageTy = 0;
      this.gestureLocked = false;
      document.body.style.overflow = '';
    },
    prevImage() {
      // 切换前硬停全站
      hardStopAll(null);
      if (this.previewIndex > 0) {
        this.previewIndex--;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },
    nextImage() {
      // 切换前硬停全站
      hardStopAll(null);
      if (this.previewIndex < this.mediaFiles.length - 1) {
        this.previewIndex++;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },
    rotateImage() {
      // 持续累加旋转角度，不重置，这样动画永远是顺时针
      // 0 → 90 → 180 → 270 → 360 → 450 → ...
      this.imageRotation += 90;
    },
    // 桌面端滚轮缩放
    handleWheel(e) {
      // 只对图片生效
      if (!this.currentPreviewFile || !this.isImage(this.currentPreviewFile)) return;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      let newScale = this.imageScale + delta;

      // 限制缩放范围 0.5 ~ 4
      newScale = Math.max(0.5, Math.min(4, newScale));
      this.imageScale = newScale;

      // 缩放到1以下时重置位移
      if (newScale <= 1) {
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },
    // 桌面端鼠标拖拽：开始
    onImageMouseDown(e) {
      // 只有放大时才能拖拽
      if (this.imageScale <= 1) return;
      e.preventDefault();
      this.imageDragging = true;
      this.imageDragStart = {
        x: e.clientX,
        y: e.clientY
      };
      this.imageStartTx = this.imageTx;
      this.imageStartTy = this.imageTy;
    },
    // 桌面端鼠标拖拽：移动
    onImageMouseMove(e) {
      if (!this.imageDragging) return;
      const dx = e.clientX - this.imageDragStart.x;
      const dy = e.clientY - this.imageDragStart.y;
      this.imageTx = this.imageStartTx + dx;
      this.imageTy = this.imageStartTy + dy;
    },
    // 桌面端鼠标拖拽：结束
    onImageMouseUp() {
      this.imageDragging = false;
    },
    // 手机端滑动：开始
    onSwipeStart(e) {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      const t = e.touches[0];
      this.swipeStartX = t.clientX;
      this.swipeStartY = t.clientY;
      this.swipeStartT = performance.now();
      this.swipeX = 0;
      this.swipeActive = false;
      this.viewportW = this.$refs.mobileViewport?.getBoundingClientRect().width || window.innerWidth;
    },
    // 手机端滑动：移动
    onSwipeMove(e) {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      const t = e.touches[0];
      const dx = t.clientX - this.swipeStartX;
      const dy = t.clientY - this.swipeStartY;
      if (!this.swipeActive) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        this.swipeActive = true;
      }
      e.preventDefault();
      let x = dx;
      // 边界阻尼：用 rubberBand 代替线性 *0.3
      if (this.previewIndex === 0 && x > 0) {
        x = this.rubberBand(x, this.viewportW, 0.55);
      } else if (this.previewIndex === this.mediaFiles.length - 1 && x < 0) {
        x = -this.rubberBand(-x, this.viewportW, 0.55);
      }
      this.swipeX = x;
    },
    // 手机端滑动：结束
    onSwipeEnd() {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      if (!this.swipeActive) {
        this.swipeX = 0;
        return;
      }
      const dt = Math.max(1, performance.now() - this.swipeStartT);
      const vx = this.swipeX / dt;
      const threshold = this.viewportW * 0.2;
      let dir = 0;
      if (this.swipeX <= -threshold || vx <= -0.8) dir = +1;
      if (this.swipeX >= threshold || vx >= 0.8) dir = -1;
      if (dir === -1 && this.previewIndex === 0 || dir === +1 && this.previewIndex === this.mediaFiles.length - 1) {
        dir = 0;
      }
      this.swipeDir = dir;
      this.swipeAnimating = true;
      if (dir === +1) this.swipeX = -this.viewportW;else if (dir === -1) this.swipeX = +this.viewportW;else this.swipeX = 0;
    },
    onSwipeTransitionEnd() {
      if (!this.swipeAnimating) return;
      if (this.swipeDir === +1) this.previewIndex++;
      if (this.swipeDir === -1) this.previewIndex--;
      this.swipeAnimating = false;
      this.swipeDir = 0;
      this.swipeX = 0;
    },
    // iOS 风格橡皮筋阻尼函数
    rubberBand(distance, dimension, constant = 0.55) {
      return distance * dimension * constant / (dimension + constant * distance);
    },
    // 放大状态下边界滑动翻页（带动画）
    onEdgeSwipe(dir) {
      // dir: +1 下一页, -1 上一页
      if (dir === -1 && this.previewIndex === 0 || dir === +1 && this.previewIndex === this.mediaFiles.length - 1) {
        return;
      }

      // 触发轮播动画
      this.swipeDir = dir;
      this.swipeAnimating = true;
      if (dir === +1) this.swipeX = -this.viewportW;else if (dir === -1) this.swipeX = +this.viewportW;
    },
    // ========== 音频滑动切换 ==========
    // 音频滑动开始
    onAudioSwipeStart(e) {
      const t = e.touches[0];
      this.audioSwipeStartX = t.clientX;
      this.audioSwipeStartT = performance.now();
      this.audioSwipeActive = false;
    },
    // 音频滑动移动
    onAudioSwipeMove(e) {
      if (!this.audioSwipeStartX) return;
      const t = e.touches[0];
      const dx = t.clientX - this.audioSwipeStartX;
      // 水平滑动超过 30px 才激活
      if (Math.abs(dx) > 30) {
        this.audioSwipeActive = true;
      }
    },
    // 音频滑动结束：切换上一首/下一首
    onAudioSwipeEnd(e) {
      if (!this.audioSwipeActive) {
        this.audioSwipeStartX = 0;
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - this.audioSwipeStartX;
      const dt = Math.max(1, performance.now() - this.audioSwipeStartT);
      const vx = dx / dt;

      // 滑动距离超过 80px 或速度超过 0.5 触发切换
      const threshold = 80;
      if (dx > threshold || vx > 0.5) {
        // 右滑 → 上一首
        this.prevImage();
      } else if (dx < -threshold || vx < -0.5) {
        // 左滑 → 下一首
        this.nextImage();
      }
      this.audioSwipeStartX = 0;
      this.audioSwipeActive = false;
    },
    // 桌面端视频播放时，硬停其他所有媒体
    onDesktopVideoPlay(e) {
      hardStopAll(e.target);
    },
    // 手机端媒体播放时，硬停其他所有媒体
    onMobileMediaPlay(e) {
      hardStopAll(e.target);
    },
    // 音频播放结束：顺序播放模式下切换下一首
    onAudioEnded(action) {
      if (action === 'next') {
        // 顺序播放：切换到下一首
        if (this.previewIndex < this.mediaFiles.length - 1) {
          this.previewIndex++;
          // 等待 DOM 更新后自动播放下一首
          this.$nextTick(() => {
            setTimeout(() => {
              const audioRef = this.isMobile ? this.$refs.mobileAudio : this.$refs.desktopAudio;
              if (audioRef?.player) {
                audioRef.player.play();
              }
            }, 100);
          });
        }
      }
    }
  }
};
