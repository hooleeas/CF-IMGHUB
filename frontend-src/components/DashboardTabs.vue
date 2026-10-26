import "core-js/modules/es.array.push.js";
import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.filter.js";
import "core-js/modules/es.iterator.find.js";
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
export default {
  name: 'DashboardTabs',
  props: {
    activeTab: {
      type: String,
      default: 'systemConfig'
    }
  },
  components: {
    LanguageSwitcher
  },
  data() {
    return {
      isPageMenuOpen: false
    };
  },
  computed: {
    pageOptions() {
      return [{
        name: 'customerConfig',
        icon: 'user-cog',
        label: 'dashboardTabs.userManagement'
      }, {
        name: 'systemConfig',
        icon: 'cogs',
        label: 'dashboardTabs.systemSettings'
      }, {
        name: '',
        icon: 'upload',
        label: 'dashboardTabs.fileUpload'
      }];
    },
    orderedPageOptions() {
      const activeOption = this.pageOptions.find(option => option.name === this.activeTab) || this.pageOptions[0];
      return [activeOption, ...this.pageOptions.filter(option => option.name !== activeOption.name)];
    }
  },
  methods: {
    handleDocumentClick(event) {
      if (this.$el?.contains(event.target)) {
        return;
      }
      this.closePageMenu();
    },
    refreshCurrentPage() {
      location.reload();
    },
    handleTabClick(tab) {
      this.closePageMenu();
      if (tab === this.activeTab) {
        this.refreshCurrentPage();
        return;
      }
      this.$router.push(tab === 'systemConfig' ? '/admin' : `/${tab}`);
    },
    isTouchViewport() {
      return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    },
    handlePageOptionClick(tab) {
      if (this.isTouchViewport() && !this.isPageMenuOpen && tab !== this.activeTab) {
        this.openPageMenu();
        return;
      }
      if (tab === this.activeTab) {
        this.togglePageMenu();
        return;
      }
      this.handleTabClick(tab);
    },
    openPageMenu() {
      this.isPageMenuOpen = true;
    },
    togglePageMenu() {
      this.isPageMenuOpen = !this.isPageMenuOpen;
    },
    closePageMenu() {
      this.isPageMenuOpen = false;
    }
  },
  mounted() {
    document.addEventListener('click', this.handleDocumentClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
  }
};
