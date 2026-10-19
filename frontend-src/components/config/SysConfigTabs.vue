export default {
  name: 'SysConfigTabs',
  props: {
    activeIndex: {
      type: String,
      default: 'status'
    },
    isCollapse: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      expandedWidth: null,
      menuItems: [{
        index: 'status',
        icon: 'chart-bar',
        titleKey: 'sysConfigTabs.systemStatus'
      }, {
        index: 'upload',
        icon: 'cloud-upload',
        titleKey: 'sysConfigTabs.uploadSettings'
      }, {
        index: 'security',
        icon: 'shield',
        titleKey: 'sysConfigTabs.securitySettings'
      }, {
        index: 'page',
        icon: 'pager',
        titleKey: 'sysConfigTabs.pageSettings'
      }, {
        index: 'others',
        icon: 'cog',
        titleKey: 'sysConfigTabs.otherSettings'
      }]
    };
  },
  computed: {
    collapsedWidth() {
      return window.innerWidth <= 768 ? 50 : 56;
    },
    sidebarStyle() {
      if (this.isCollapse) {
        return {
          width: this.collapsedWidth + 'px'
        };
      }
      return this.expandedWidth ? {
        width: this.expandedWidth + 'px'
      } : {};
    }
  },
  watch: {
    '$i18n.locale'() {
      this.$nextTick(() => this.measureWidth());
    }
  },
  methods: {
    toggleCollapse() {
      this.$emit('update:isCollapse', !this.isCollapse);
    },
    checkMobile() {
      const isMobile = window.innerWidth <= 768;
      this.$emit('update:isCollapse', isMobile);
    },
    handleSelect(index) {
      this.$emit('update:activeIndex', index);
    },
    measureWidth() {
      const el = this.$refs.sidebar;
      if (!el) return;
      // Temporarily expand to measure natural content width
      const prevWidth = el.style.width;
      const prevTransition = el.style.transition;
      const wasCollapsed = el.classList.contains('is-collapsed');
      el.style.transition = 'none';
      if (wasCollapsed) {
        el.classList.remove('is-collapsed');
      }
      el.style.width = 'auto';
      // Force reflow to apply changes
      void el.offsetWidth;
      const natural = el.scrollWidth;
      // Restore original state
      el.style.width = prevWidth;
      if (wasCollapsed) {
        el.classList.add('is-collapsed');
      }
      void el.offsetWidth;
      el.style.transition = prevTransition;
      this.expandedWidth = natural;
    }
  },
  mounted() {
    this.checkMobile();
    this.$nextTick(() => this.measureWidth());
    window.addEventListener('resize', this.checkMobile);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.checkMobile);
  }
};