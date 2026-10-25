import { setLocale } from '@/locales';
import { h } from 'vue';
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
  },
  render() {
    return h('span', {
      class: 'language-switcher',
      onClick: this.toggleLocale,
      onKeydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.toggleLocale();
        }
      },
      role: 'button',
      tabindex: 0,
      title: this.$t('language.switchTo')
    }, [
      h('span', { class: 'text-language-icon', 'aria-hidden': 'true' }, [
        h('span', { class: 'text-language-icon-primary' }, '文'),
        h('span', { class: 'text-language-icon-secondary' }, 'A')
      ])
    ]);
  }
};