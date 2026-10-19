import axios from '@/utils/axios';
import fetchWithAuth from '@/utils/fetchWithAuth';
export default {
  name: 'DirectoryTreePicker',
  props: {
    currentDirectory: {
      type: String,
      default: ''
    },
    source: {
      type: String,
      default: 'upload',
      validator: value => ['upload', 'admin'].includes(value)
    }
  },
  data() {
    return {
      popoverVisible: false,
      drawerVisible: false,
      treeData: [],
      loading: false,
      error: '',
      treeProps: {
        children: 'children',
        label: 'name'
      },
      windowWidth: window.innerWidth
    };
  },
  computed: {
    isDesktop() {
      return this.windowWidth >= 769;
    }
  },
  watch: {
    popoverVisible(newVal) {
      if (newVal) {
        this.fetchDirectoryTree();
      } else {
        // 弹窗关闭后延迟折叠所有节点，避免下次打开时出现折叠动画
        setTimeout(() => {
          if (!this.popoverVisible && this.$refs.treeRef) {
            const store = this.$refs.treeRef.store;
            for (const key in store.nodesMap) {
              store.nodesMap[key].expanded = false;
            }
          }
        }, 200);
      }
    },
    drawerVisible(newVal) {
      if (newVal) {
        this.fetchDirectoryTree();
      } else {
        // 抽屉关闭后延迟折叠所有节点
        setTimeout(() => {
          if (!this.drawerVisible && this.$refs.treeRefMobile) {
            const store = this.$refs.treeRefMobile.store;
            for (const key in store.nodesMap) {
              store.nodesMap[key].expanded = false;
            }
          }
        }, 300);
      }
    },
    currentDirectory(newVal) {
      this.$nextTick(() => {
        if (this.$refs.treeRef && newVal) {
          this.$refs.treeRef.setCurrentKey(newVal);
        }
        if (this.$refs.treeRefMobile && newVal) {
          this.$refs.treeRefMobile.setCurrentKey(newVal);
        }
      });
    }
  },
  mounted() {
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    handleResize() {
      this.windowWidth = window.innerWidth;
    },
    openDrawer() {
      this.drawerVisible = true;
    },
    async fetchDirectoryTree() {
      this.loading = true;
      this.error = '';
      try {
        let data;
        if (this.source === 'admin') {
          const response = await fetchWithAuth('/api/directoryTree', {
            method: 'GET'
          });
          if (!response.ok) {
            if (response.status === 401) {
              this.error = this.$t('directoryTree.authFailed');
            } else {
              this.error = this.$t('directoryTree.serverError');
            }
            return;
          }
          data = await response.json();
        } else {
          const response = await axios.get('/api/directoryTree', {
            withAuthCode: true
          });
          data = response.data;
        }
        if (data.tree) {
          this.treeData = [data.tree];
        } else {
          this.treeData = [];
        }
      } catch (err) {
        console.error('Failed to fetch directory tree:', err);
        if (err.response?.status === 401) {
          this.error = this.$t('directoryTree.authFailed');
        } else {
          this.error = this.$t('directoryTree.loadFailed');
        }
      } finally {
        this.loading = false;
      }
    },
    handleNodeClick(data) {
      let path = data.path;
      if (path && !path.startsWith('/')) {
        path = '/' + path;
      } else if (!path) {
        path = '/';
      }
      this.$emit('select', path);
      this.popoverVisible = false;
      this.drawerVisible = false;
    }
  }
};