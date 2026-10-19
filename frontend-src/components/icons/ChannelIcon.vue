export default {
  name: 'ChannelIcon',
  inheritAttrs: false,
  props: {
    type: {
      type: String,
      required: true
    }
  },
  computed: {
    fontAwesomeIcon() {
      const icons = {
        cfr2: ['fab', 'cloudflare'],
        s3: ['fab', 'aws'],
        discord: ['fab', 'discord']
      };
      return icons[this.type] || 'server';
    }
  }
};