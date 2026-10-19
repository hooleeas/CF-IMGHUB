export default {
  name: 'FloatingSaveButton',
  emits: ['click'],
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    show: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      visible: false
    };
  },
  watch: {
    show: {
      immediate: true,
      handler(val) {
        if (val) {
          // 延迟显示，等待 Element Plus 加载遮罩淡出动画完成
          setTimeout(() => {
            this.visible = true;
          }, 600);
        } else {
          this.visible = false;
        }
      }
    }
  },
  methods: {
    handleClick() {
      if (!this.loading) {
        this.$emit('click');
      }
    }
  }
};