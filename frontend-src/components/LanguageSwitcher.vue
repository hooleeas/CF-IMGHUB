import { setLocale } from '@/locales';
export default {
  name: 'LanguageSwitcher',
  computed: {
    isZh() {
      return this.$i18n.locale === 'zh-CN';
    }
  },
  methods: {
    toggleLocale() {
      const next = this.isZh ? 'en' : 'zh-CN';
      setLocale(next);
    }
  }
};