import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.filter.js";
import "core-js/modules/es.iterator.map.js";
import "core-js/modules/es.iterator.some.js";
import fetchWithAuth from '@/utils/fetchWithAuth';
import DashboardTabs from '@/components/DashboardTabs.vue';
import backgroundManager from '@/mixins/backgroundManager';
export default {
  name: 'CustomerConfig',
  mixins: [backgroundManager],
  data() {
    return {
      tableData: [],
      dealedData: [],
      // 根据IP地址处理后的数据，格式为 {ip, count, [data]}
      blockipList: [],
      // 禁止上传的IP列表

      loading: false,
      // 分页数据
      currentPage: 1,
      pageSize: 10 // 默认每页10条
    };
  },
  components: {
    DashboardTabs
  },
  computed: {
    disableTooltip() {
      return window.innerWidth < 768;
    },
    pagerCount() {
      return window.innerWidth < 768 ? 3 : 7;
    },
    paginatedData() {
      // 计算分页数据
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.dealedData.slice(start, end);
    }
  },
  methods: {
    formatTimeStamp(timeStamp) {
      return new Date(timeStamp).toLocaleString();
    },
    sortByTimestamp(a, b) {
      return new Date(a.metadata.TimeStamp) - new Date(b.metadata.TimeStamp);
    },
    async handleSwitchEnable(row) {
      const ip = row.ip;
      const enable = row.enable;
      if (enable) {
        // 从 blockipList 中移除
        this.blockipList = this.blockipList.filter(item => item !== ip);
        // 更新 blockipList
        await fetchWithAuth("/api/manage/cusConfig/whiteip", {
          method: 'POST',
          body: ip
        });
      } else {
        // 添加到 blockipList 中
        this.blockipList.push(ip);
        // 更新 blockipList
        await fetchWithAuth("/api/manage/cusConfig/blockip", {
          method: 'POST',
          body: ip
        });
      }
    },
    handlePageChange(page) {
      this.currentPage = page;
      // 到最后一页时，加载更多数据
      if (page === Math.ceil(this.dealedData.length / this.pageSize)) {
        this.loadMoreData();
      }
    },
    async handleExpandChange(row, expandedRows) {
      if (!expandedRows.some(item => item.ip === row.ip) || row.filesLoaded || row.filesLoading) return;
      row.filesLoading = true;
      try {
        const response = await fetchWithAuth(`/api/manage/cusConfig/files?ip=${encodeURIComponent(row.ip)}&count=${row.count}`, {
          method: 'GET'
        });
        const result = await response.json();
        row.data = (result.data || []).sort(this.sortByTimestamp).reverse();
        row.filesLoaded = true;
      } catch (err) {
        this.$message.error(this.$t('customerConfig.loadError'));
      } finally {
        row.filesLoading = false;
      }
    },
    loadMoreData() {
      this.loading = true;
      const start = this.dealedData.length;
      const count = 20; // 每次加载20条数据
      fetchWithAuth(`/api/manage/cusConfig/list?start=${start}&count=${count}`, {
        method: 'GET'
      }).then(response => response.json()).then(result => {
        this.dealedData = this.dealedData.concat(result.map(item => {
          const enable = !this.blockipList.includes(item.ip);
          return {
            ip: item.ip,
            address: item.address,
            count: item.count,
            data: [],
            filesLoaded: false,
            filesLoading: false,
            enable: enable
          };
        }));
      }).catch(() => {
        this.$message.error(this.$t('customerConfig.loadError'));
      }).finally(() => {
        this.loading = false;
      });
    },
    handleSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
    }
  },
  mounted() {
    // 初始化背景图
    this.loading = true;

    // 路由守卫已通过 /api/auth/sessionCheck 验证认证状态
    this.showLogoutButton = this.$store.state.adminLoggedIn;
    fetchWithAuth("/api/manage/cusConfig/list?count=20", {
      method: 'GET'
    }).then(response => response.json()).then(async result => {
      // 读取blockipList, 接口返回格式为 'ip1,ip2,ip3'，需要转换为数组
      const blockipList = await fetchWithAuth("/api/manage/cusConfig/blockipList", {
        method: 'GET'
      });
      this.blockipList = (await blockipList.text()).split(',');
      this.dealedData = result.map(item => {
        const enable = !this.blockipList.includes(item.ip);
        return {
          ip: item.ip,
          address: item.address,
          count: item.count,
          data: [],
          filesLoaded: false,
          filesLoading: false,
          enable: enable
        };
      });
    }).catch(err => {
      if (err.message !== 'Unauthorized') {
        this.$message.error(this.$t('customerConfig.syncError'));
      }
    }).finally(() => {
      this.loading = false;
    });
  }
};
