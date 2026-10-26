import "core-js/modules/es.array.push.js";
import { useHead } from '@vueuse/head';
import { mapGetters } from 'vuex';
import backgroundManager from '@/mixins/backgroundManager';
export default {
  name: 'WhiteListOn',
  mixins: [backgroundManager],
  computed: {
    ...mapGetters(['userConfig'])
  },
  setup() {
    useHead({
      title: 'White List On',
      meta: [{
        name: 'robots',
        content: 'noindex, nofollow'
      }, {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      }, {
        charset: 'UTF-8'
      }]
    });
  },
  mounted() {
    // 初始化背景图
    this.initializeBackground('uploadBkImg', '.whitelist-container', false, true);
  },
  beforeUnmount() {
    // 清理背景轮播定时器
    this.clearBackgroundInterval();
  },
  methods: {
    goHome() {
      this.$router.push('/');
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1);
      } else {
        this.$router.push('/');
      }
    },
    refreshPage() {
      window.location.reload();
    }
  }
};
