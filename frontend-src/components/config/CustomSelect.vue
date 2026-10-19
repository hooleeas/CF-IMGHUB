import "core-js/modules/es.iterator.constructor.js";
import "core-js/modules/es.iterator.find.js";
import ChannelIcon from '@/components/icons/ChannelIcon.vue';
export default {
  name: 'CustomSelect',
  components: {
    ChannelIcon
  },
  props: {
    modelValue: {
      type: [String, Number],
      default: ''
    },
    options: {
      type: Array,
      required: true
      // 格式: [{ value: '', label: '', icon?: '', iconClass?: '', channelType?: '' }]
    },
    placeholder: {
      type: String,
      default: ''
    },
    width: {
      type: String,
      default: '160px'
    }
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      isOpen: false
    };
  },
  computed: {
    resolvedPlaceholder() {
      return this.placeholder || this.$t('common.select');
    },
    displayLabel() {
      const selected = this.options.find(opt => opt.value === this.modelValue);
      return selected ? selected.label : this.resolvedPlaceholder;
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    toggleDropdown() {
      this.isOpen = !this.isOpen;
    },
    selectOption(value) {
      this.$emit('update:modelValue', value);
      this.$emit('change', value);
      this.isOpen = false;
    },
    handleClickOutside(e) {
      if (!this.$el.contains(e.target)) {
        this.isOpen = false;
      }
    }
  }
};