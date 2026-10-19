import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.for-each.js";
import "core-js/modules/es.iterator.map.js";
import "core-js/modules/es.iterator.reduce.js";
import "core-js/modules/es.set.difference.v2.js";
import "core-js/modules/es.set.intersection.v2.js";
import "core-js/modules/es.set.is-disjoint-from.v2.js";
import "core-js/modules/es.set.is-subset-of.v2.js";
import "core-js/modules/es.set.is-superset-of.v2.js";
import "core-js/modules/es.set.symmetric-difference.v2.js";
import "core-js/modules/es.set.union.v2.js";
import fetchWithAuth from '@/utils/fetchWithAuth';
import packageInfo from '../../../package.json';
import { Doughnut, Line } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import IndexRebuilder from '@/utils/indexRebuilder';
import BackupGenerator from '@/utils/backupGenerator';
import RestoreProcessor from '@/utils/restoreProcessor';
import DateRangeCalendar from '@/components/DateRangeCalendar.vue';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);
const DAY_MS = 24 * 60 * 60 * 1000;
function padDatePart(value) {
  return String(value).padStart(2, '0');
}
function formatDateInput(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}
function getDefaultTrendDateRange() {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate.getTime() - 6 * DAY_MS);
  return [formatDateInput(startDate), formatDateInput(endDate)];
}
export default {
  name: 'SysCogStatus',
  components: {
    Doughnut,
    Line,
    DateRangeCalendar
  },
  data() {
    return {
      loading: false,
      rebuilding: false,
      backing: false,
      restoring: false,
      indexInfo: {},
      version: packageInfo.version,
      // 从package.json获取版本号
      loadErrors: {
        newest: false,
        oldest: false
      },
      trendGroupBy: 'channel',
      trendDatePickerVisible: false,
      trendDateRange: getDefaultTrendDateRange(),
      // 渠道图表颜色
      channelColors: ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#84CC16'],
      // 状态图表颜色
      typeColors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
      // 上传趋势折线图颜色
      trendColors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#64748B'],
      // 批量操作进度状态
      isProcessing: false,
      processingPhase: '',
      // fetching, sorting, uploading, finalizing, building, downloading, completed
      processingProgress: {
        current: 0,
        total: 0,
        message: '',
        percentage: 0
      },
      processingError: null,
      processingStartTime: null,
      // 当前处理器实例（用于取消操作）
      currentRebuilder: null,
      currentBackupGenerator: null,
      currentRestoreProcessor: null
    };
  },
  computed: {
    // 渠道分布图表数据
    channelChartData() {
      const stats = this.indexInfo.channelStats || {};
      return {
        labels: Object.keys(stats),
        datasets: [{
          data: Object.values(stats),
          backgroundColor: this.channelColors.slice(0, Object.keys(stats).length),
          borderWidth: 0
        }]
      };
    },
    // 文件状态图表数据 - 将Block映射为"已屏蔽"，其余为"正常"
    typeChartData() {
      const aggregatedStats = this.aggregatedTypeStats;
      return {
        labels: Object.keys(aggregatedStats),
        datasets: [{
          data: Object.values(aggregatedStats),
          backgroundColor: this.typeColors.slice(0, Object.keys(aggregatedStats).length),
          borderWidth: 0
        }]
      };
    },
    // 聚合后的状态统计：Block -> 已屏蔽，其余 -> 正常
    aggregatedTypeStats() {
      const stats = this.indexInfo.typeStats || {};
      const aggregatedStats = {};
      for (const [status, count] of Object.entries(stats)) {
        const mappedStatus = status === 'Block' ? this.$t('sysStatus.blocked') : this.$t('sysStatus.normalStatus');
        aggregatedStats[mappedStatus] = (aggregatedStats[mappedStatus] || 0) + count;
      }
      return aggregatedStats;
    },
    // 当前趋势维度数据
    currentTrendGroup() {
      const trend = this.indexInfo.uploadTrend || {};
      const groupBy = trend.groupBy || {};
      return groupBy[this.trendGroupBy] || {
        series: []
      };
    },
    // 趋势图原始日期标签
    trendRawLabels() {
      const trend = this.indexInfo.uploadTrend || {};
      return trend.labels || [];
    },
    // 当前范围是否跨年
    trendRangeCrossesYear() {
      const years = new Set();
      this.trendRawLabels.forEach(label => {
        this.extractTrendLabelDates(label).forEach(date => years.add(date.year));
      });
      return years.size > 1;
    },
    // 用于横轴展示的短日期标签
    trendDisplayLabels() {
      return this.trendRawLabels.map(label => this.formatTrendAxisLabel(label));
    },
    // 是否存在趋势图数据
    hasTrendData() {
      const trend = this.indexInfo.uploadTrend || {};
      return (trend.labels || []).length > 0;
    },
    // 日期选择弹窗宽度保持与项目内其他弹窗一致
    trendDateDialogWidth() {
      return window.innerWidth > 768 ? '420px' : '90%';
    },
    // 上传趋势折线图数据
    uploadTrendChartData() {
      const trend = this.indexInfo.uploadTrend || {};
      const series = this.currentTrendGroup.series || [];
      const totalColor = '#F97316';
      return {
        labels: this.trendDisplayLabels,
        datasets: [{
          label: this.$t('sysStatus.totalUploads'),
          data: trend.total || [],
          borderColor: totalColor,
          backgroundColor: this.hexToRgba(totalColor, 0.1),
          pointBackgroundColor: totalColor,
          pointBorderColor: totalColor,
          borderWidth: 3,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.28,
          fill: false
        }, ...series.map((item, index) => {
          const color = this.getTrendColor(index);
          return {
            label: this.formatTrendSeriesName(item),
            data: item.data || [],
            borderColor: color,
            backgroundColor: this.hexToRgba(color, 0.12),
            pointBackgroundColor: color,
            pointBorderColor: color,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            tension: 0.32,
            fill: false
          };
        })]
      };
    },
    // 折线图配置
    lineChartOptions() {
      const textColor = '#64748B';
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              boxHeight: 8,
              padding: 16,
              color: textColor
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              title: items => {
                const index = items?.[0]?.dataIndex;
                return this.trendRawLabels[index] || '';
              },
              label: context => {
                const parsed = context.parsed || {};
                const value = parsed.y !== undefined ? parsed.y : context.raw;
                return ` ${context.dataset.label}: ${Number(value || 0).toLocaleString()} ${this.$t('sysStatus.uploadsUnit')}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textColor,
              maxTicksLimit: 8,
              autoSkip: true
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.18)'
            },
            ticks: {
              color: textColor,
              precision: 0,
              callback: value => Number(value).toLocaleString()
            }
          }
        }
      };
    },
    // 图表配置
    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        hoverOffset: 8,
        layout: {
          padding: 10
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            z: 100,
            callbacks: {
              label: context => {
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = (value / total * 100).toFixed(1);
                return ` ${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      };
    },
    // 预计剩余时间
    estimatedTimeRemaining() {
      if (!this.isProcessing || !this.processingStartTime) return '';
      if (this.processingProgress.current === 0 || this.processingProgress.percentage === 0) return '';
      const elapsed = Date.now() - this.processingStartTime;
      const progress = this.processingProgress.percentage / 100;
      if (progress <= 0) return '';
      const totalEstimated = elapsed / progress;
      const remaining = totalEstimated - elapsed;
      if (remaining <= 0) return this.$t('sysStatus.aboutToComplete');
      const seconds = Math.ceil(remaining / 1000);
      if (seconds < 60) return this.$t('sysStatus.seconds', {
        count: seconds
      });
      const minutes = Math.ceil(seconds / 60);
      if (minutes < 60) return this.$t('sysStatus.minutes', {
        count: minutes
      });
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return this.$t('sysStatus.hoursMinutes', {
        hours,
        minutes: remainingMinutes
      });
    },
    // 处理阶段描述
    phaseDescription() {
      const phaseMap = {
        'fetching': this.$t('sysStatus.phaseFetching'),
        'sorting': this.$t('sysStatus.phaseSorting'),
        'uploading': this.$t('sysStatus.phaseUploading'),
        'finalizing': this.$t('sysStatus.phaseFinalizing'),
        'building': this.$t('sysStatus.phaseBuilding'),
        'downloading': this.$t('sysStatus.phaseDownloading'),
        'restoring_files': this.$t('sysStatus.phaseRestoringFiles'),
        'restoring_settings': this.$t('sysStatus.phaseRestoringSettings'),
        'completed': this.$t('sysStatus.phaseCompleted'),
        'retrying': this.$t('sysStatus.phaseRetrying')
      };
      return phaseMap[this.processingPhase] || this.processingPhase;
    }
  },
  mounted() {
    this.fetchIndexInfo();
  },
  methods: {
    // 获取渠道图表颜色
    getChartColor(index) {
      return this.channelColors[index % this.channelColors.length];
    },
    // 获取状态图表颜色
    getTypeChartColor(index) {
      return this.typeColors[index % this.typeColors.length];
    },
    // 获取趋势图表颜色
    getTrendColor(index) {
      return this.trendColors[index % this.trendColors.length];
    },
    // 格式化趋势序列名称
    formatTrendSeriesName(series) {
      if (series?.isOther || series?.name === '__other__') {
        return this.$t('sysStatus.otherChannels');
      }
      return series?.name || this.$t('sysStatus.unknown');
    },
    // 十六进制颜色转换为 rgba
    hexToRgba(hex, alpha) {
      const normalized = (hex || '').replace('#', '');
      if (normalized.length !== 6) {
        return `rgba(37, 99, 235, ${alpha})`;
      }
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
    // 提取趋势标签中的日期
    extractTrendLabelDates(label) {
      const matches = String(label || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
      return matches.map(item => {
        const [year, month, day] = item.split('-').map(Number);
        return {
          year,
          month,
          day
        };
      });
    },
    // 横轴日期标签按范围简化，仅跨年时显示年份
    formatTrendAxisLabel(label) {
      const dates = this.extractTrendLabelDates(label);
      if (dates.length === 0) return label;
      const formatSingleDate = (date, includeYear) => {
        const monthDay = `${date.month}/${date.day}`;
        return includeYear ? `${date.year}/${monthDay}` : monthDay;
      };
      if (dates.length === 1) {
        return formatSingleDate(dates[0], this.trendRangeCrossesYear);
      }
      const [startDate, endDate] = dates;
      if (!this.trendRangeCrossesYear) {
        return `${formatSingleDate(startDate, false)}-${formatSingleDate(endDate, false)}`;
      }
      const endLabel = startDate.year === endDate.year ? formatSingleDate(endDate, false) : formatSingleDate(endDate, true);
      return `${formatSingleDate(startDate, true)}-${endLabel}`;
    },
    // 打开居中的日期范围选择弹窗
    openTrendDateDialog() {
      this.trendDatePickerVisible = true;
    },
    // 日期范围变更后重新拉取趋势数据
    handleTrendDateRangeChange(value) {
      if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
        return;
      }
      this.trendDatePickerVisible = false;
      this.fetchIndexInfo();
    },
    // 获取趋势查询参数
    getTrendDateRangeParams() {
      if (!Array.isArray(this.trendDateRange) || this.trendDateRange.length !== 2) {
        this.trendDateRange = getDefaultTrendDateRange();
      }
      return {
        startDate: this.trendDateRange[0],
        endDate: this.trendDateRange[1]
      };
    },
    // 获取索引信息
    async fetchIndexInfo() {
      this.loading = true;
      try {
        const {
          startDate,
          endDate
        } = this.getTrendDateRangeParams();
        const params = new URLSearchParams({
          action: 'info',
          timezoneOffset: String(new Date().getTimezoneOffset()),
          trendMaxPoints: '90',
          trendSeriesLimit: '8',
          trendStartDate: startDate,
          trendEndDate: endDate
        });
        const response = await fetchWithAuth(`/api/manage/list?${params.toString()}`, {
          method: 'GET'
        });
        if (response.ok) {
          const data = await response.json();
          this.indexInfo = data;
        } else {
          throw new Error('API请求失败');
        }
      } catch (error) {
        console.error('获取索引信息失败:', error);
        this.$message.error(this.$t('sysStatus.fetchIndexFailed'));
      } finally {
        this.loading = false;
      }
    },
    // 重建索引 - 使用前端辅助重建流程
    async rebuildIndex() {
      if (this.isProcessing) {
        this.$message.warning(this.$t('sysStatus.operationInProgress'));
        return;
      }
      this.rebuilding = true;
      this.isProcessing = true;
      this.processingError = null;
      this.processingStartTime = Date.now();
      this.processingProgress = {
        current: 0,
        total: 0,
        message: '',
        percentage: 0
      };

      // 创建 IndexRebuilder 实例
      this.currentRebuilder = new IndexRebuilder({
        onProgress: progress => this.handleProgress(progress),
        onError: error => this.handleError(error)
      });
      try {
        const result = await this.currentRebuilder.rebuild();

        // 成功完成
        this.$message.success(this.$t('sysStatus.rebuildSuccess', {
          count: result.totalFiles.toLocaleString()
        }));

        // 刷新索引信息
        setTimeout(() => {
          this.fetchIndexInfo();
        }, 1000);
      } catch (error) {
        // 错误处理
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion ? `${error.message}。${error.suggestion}` : error.message;
          this.$message.error(errorMessage);
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          };
        }
      } finally {
        this.rebuilding = false;
        this.isProcessing = false;
        this.currentRebuilder = null;
        this.processingStartTime = null;
      }
    },
    // 备份数据 - 使用前端辅助备份流程
    async backupData() {
      if (this.isProcessing) {
        this.$message.warning(this.$t('sysStatus.operationInProgress'));
        return;
      }
      this.backing = true;
      this.isProcessing = true;
      this.processingError = null;
      this.processingStartTime = Date.now();
      this.processingProgress = {
        current: 0,
        total: 0,
        message: '',
        percentage: 0
      };

      // 创建 BackupGenerator 实例
      this.currentBackupGenerator = new BackupGenerator({
        onProgress: progress => this.handleProgress(progress)
      });
      try {
        const result = await this.currentBackupGenerator.generateBackup();

        // 成功完成
        const settingsMsg = result.settingsCount > 0 ? this.$t('sysStatus.backupSuccessWithSettings', {
          fileCount: result.fileCount.toLocaleString(),
          settingsCount: result.settingsCount
        }) : this.$t('sysStatus.backupSuccess', {
          count: result.fileCount.toLocaleString()
        });
        this.$message.success(settingsMsg);
      } catch (error) {
        // 错误处理
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion ? `${error.message}。${error.suggestion}` : error.message;
          this.$message.error(errorMessage);
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          };
        }
      } finally {
        this.backing = false;
        this.isProcessing = false;
        this.currentBackupGenerator = null;
        this.processingStartTime = null;
      }
    },
    // 选择恢复文件
    selectRestoreFile() {
      if (this.restoring) return;
      this.$refs.fileInput.click();
    },
    // 处理文件选择
    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.json')) {
        this.$message.error(this.$t('sysStatus.selectJsonFile'));
        return;
      }

      // 确认恢复操作
      try {
        await this.$confirm(this.$t('sysStatus.restoreConfirmMessage'), this.$t('sysStatus.restoreConfirmTitle'), {
          confirmButtonText: this.$t('sysStatus.restoreConfirmOk'),
          cancelButtonText: this.$t('sysStatus.restoreConfirmCancel'),
          type: 'warning'
        });
        await this.restoreData(file);
      } catch (error) {
        if (error !== 'cancel') {
          console.error('确认恢复失败:', error);
        }
      }

      // 清除文件选择
      event.target.value = '';
    },
    // 恢复数据 - 使用前端辅助分批恢复流程
    async restoreData(file) {
      if (this.isProcessing) {
        this.$message.warning(this.$t('sysStatus.operationInProgress'));
        return;
      }
      this.restoring = true;
      this.isProcessing = true;
      this.processingError = null;
      this.processingStartTime = Date.now();
      this.processingProgress = {
        current: 0,
        total: 0,
        message: '',
        percentage: 0
      };
      try {
        // 解析备份文件
        const fileContent = await file.text();
        let backupData;
        try {
          backupData = JSON.parse(fileContent);
        } catch (parseError) {
          throw new Error(this.$t('sysStatus.invalidBackupFile'));
        }

        // 创建 RestoreProcessor 实例
        this.currentRestoreProcessor = new RestoreProcessor({
          chunkSize: 100,
          // 每批恢复 100 条
          onProgress: progress => this.handleProgress(progress),
          onError: error => this.handleError(error)
        });
        const result = await this.currentRestoreProcessor.restore(backupData);

        // 恢复完成，重置恢复状态
        this.restoring = false;
        this.isProcessing = false;
        this.currentRestoreProcessor = null;
        this.processingStartTime = null;

        // 显示恢复成功消息
        this.$message.success(this.$t('sysStatus.restoreSuccess', {
          files: result.restoredFiles,
          settings: result.restoredSettings
        }));

        // 短暂延迟后自动开始重建索引
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.rebuildIndex();
      } catch (error) {
        console.error('恢复数据失败:', error);

        // 出错时重置状态
        this.restoring = false;
        this.isProcessing = false;
        this.currentRestoreProcessor = null;
        this.processingStartTime = null;
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion ? `${error.message}。${error.suggestion}` : error.message;
          this.$message.error(this.$t('sysStatus.restoreFailed') + ': ' + errorMessage);
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          };
        }
      }
    },
    // 格式化时间
    formatTime(timestamp) {
      if (!timestamp) return this.$t('sysStatus.unknown');
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    // 计算百分比
    getPercentage(value, total) {
      if (!total || total === 0) return 0;
      return Math.round(value / total * 100);
    },
    // 计算时间差
    getTimeAgo(timestamp) {
      if (!timestamp) return '';
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (days > 0) return this.$t('sysStatus.daysAgo', {
        count: days
      });
      if (hours > 0) return this.$t('sysStatus.hoursAgo', {
        count: hours
      });
      if (minutes > 0) return this.$t('sysStatus.minutesAgo', {
        count: minutes
      });
      return this.$t('sysStatus.justNow');
    },
    // 图片加载失败处理
    handleImageError(type) {
      this.loadErrors[type] = true;
    },
    // 检查是否应该显示预览图
    isValidPreview(type, file) {
      if (this.loadErrors[type]) return false;
      if (!file?.metadata?.FileType) return false;
      return file.metadata.FileType.includes('image') || file.metadata.FileType.includes('video');
    },
    // 打开发布页面
    openReleases() {
      window.open('https://github.com/hooleeas/cf-imghub/releases', '_blank');
    },
    // 判断是否为图片文件
    isImageFile(file) {
      if (!file) return false;
      // 优先通过 FileType 判断
      if (file.metadata?.FileType?.includes('image')) return true;
      // 通过文件名后缀判断
      const fileName = file.metadata?.FileName || file.id || '';
      const extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'];
      return imageExtensions.includes(extension);
    },
    // 判断是否为视频文件
    isVideoFile(file) {
      if (!file) return false;
      // 优先通过 FileType 判断
      if (file.metadata?.FileType?.includes('video')) return true;
      // 通过文件名后缀判断
      const fileName = file.metadata?.FileName || file.id || '';
      const extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
      const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv', 'wmv', 'mkv', 'm4v', '3gp', 'mpeg', 'mpg'];
      return videoExtensions.includes(extension);
    },
    // 在新窗口打开文件
    openFileInNewTab(file) {
      if (!file?.id) return;
      window.open('/file/' + file.id + '?from=admin', '_blank');
    },
    // 处理进度更新
    handleProgress(progress) {
      this.processingPhase = progress.phase;
      this.processingProgress.message = progress.message || '';
      this.processingProgress.current = progress.current || 0;

      // 根据不同阶段计算进度百分比
      if (progress.phase === 'fetching') {
        // 获取阶段：基于已获取的记录数估算（假设总数未知时显示已获取数量）
        this.processingProgress.total = progress.total || 0;
        // 获取阶段占总进度的 60%
        if (progress.total && progress.total > 0) {
          this.processingProgress.percentage = Math.min(60, progress.current / progress.total * 60);
        } else {
          // 未知总数时，使用对数增长模拟进度
          this.processingProgress.percentage = Math.min(50, Math.log10(progress.current + 1) * 15);
        }
      } else if (progress.phase === 'sorting') {
        // 排序阶段：占 60-70%
        this.processingProgress.percentage = 65;
        this.processingProgress.total = progress.total || this.processingProgress.total;
      } else if (progress.phase === 'uploading') {
        // 上传阶段：占 70-95%
        this.processingProgress.total = progress.total || 0;
        if (progress.total && progress.total > 0) {
          this.processingProgress.percentage = 70 + progress.current / progress.total * 25;
        }
      } else if (progress.phase === 'finalizing') {
        // 完成阶段：95-100%
        this.processingProgress.percentage = 97;
      } else if (progress.phase === 'building') {
        // 构建备份阶段：70-90%
        this.processingProgress.percentage = 80;
      } else if (progress.phase === 'downloading') {
        // 下载阶段：90-100%
        this.processingProgress.percentage = 95;
      } else if (progress.phase === 'restoring_files') {
        // 恢复文件阶段：0-80%
        this.processingProgress.total = progress.total || 0;
        this.processingProgress.percentage = progress.percentage || 0;
      } else if (progress.phase === 'restoring_settings') {
        // 恢复设置阶段：80-100%
        this.processingProgress.total = progress.total || 0;
        this.processingProgress.percentage = progress.percentage || 80;
      } else if (progress.phase === 'completed') {
        // 完成
        this.processingProgress.percentage = 100;
      } else if (progress.phase === 'retrying') {
        // 重试阶段：保持当前进度
        this.processingProgress.message = progress.message;
      }
    },
    // 处理错误
    handleError(error) {
      console.error('批量操作错误:', error);
      this.processingError = {
        message: error.message,
        suggestion: error.suggestion,
        recoverable: error.recoverable
      };
    },
    // 取消当前操作
    cancelOperation() {
      if (this.currentRebuilder) {
        this.currentRebuilder.abort();
        this.$message.info(this.$t('sysStatus.cancellingRebuild'));
      }
      if (this.currentBackupGenerator) {
        this.currentBackupGenerator.abort();
        this.$message.info(this.$t('sysStatus.cancellingRebuild'));
      }
      if (this.currentRestoreProcessor) {
        this.currentRestoreProcessor.abort();
        this.$message.info(this.$t('sysStatus.cancellingRebuild'));
      }
    },
    // 重试操作
    retryOperation() {
      this.processingError = null;
      if (this.rebuilding) {
        this.rebuilding = false;
        this.isProcessing = false;
        this.$nextTick(() => {
          this.rebuildIndex();
        });
      } else if (this.backing) {
        this.backing = false;
        this.isProcessing = false;
        this.$nextTick(() => {
          this.backupData();
        });
      }
    },
    // 关闭错误提示
    dismissError() {
      this.processingError = null;
    }
  }
};