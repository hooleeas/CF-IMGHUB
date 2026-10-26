import ChannelIcon from '@/components/icons/ChannelIcon.vue';
export default {
  name: 'UploadSettingsDialog',
  components: {
    ChannelIcon
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    uploadChannel: {
      type: String,
      default: 'telegram'
    },
    channelName: {
      type: String,
      default: ''
    },
    currentChannelList: {
      type: Array,
      default: () => []
    },
    autoRetry: {
      type: Boolean,
      default: true
    },
    uploadNameType: {
      type: String,
      default: 'default'
    },
    convertToWebp: {
      type: Boolean,
      default: false
    },
    customerCompress: {
      type: Boolean,
      default: true
    },
    compressBar: {
      type: Number,
      default: 5
    },
    compressQuality: {
      type: Number,
      default: 4
    },
    serverCompress: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue', 'update:uploadChannel', 'update:channelName', 'update:autoRetry', 'update:uploadNameType', 'update:convertToWebp', 'update:customerCompress', 'update:compressBar', 'update:compressQuality', 'update:serverCompress'],
  computed: {
    visible: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit('update:modelValue', val);
      }
    },
    dialogWidth() {
      return window.innerWidth > 768 ? '50%' : '90%';
    }
  }
};