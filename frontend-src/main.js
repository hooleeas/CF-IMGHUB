import { createApp } from 'vue'
import { createHead } from '@vueuse/head'; // 导入 createHead
import ElementPlus from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import fontAwesomeIcons from './utils/fontawesomeIcons';

import App from './App.vue'
import router from './router'
import store from './store'
import i18n from './locales'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/global.css'

// OverlayScrollbars 悬浮滚动条
import 'overlayscrollbars/overlayscrollbars.css'


library.add(...fontAwesomeIcons);

const app = createApp(App);
const head = createHead(); // 创建 head 对象

app.component('font-awesome-icon', FontAwesomeIcon);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

const SYSTEM_THEME = window.matchMedia('(prefers-color-scheme: dark)');
const applySystemTheme = () => {
    document.documentElement.classList.toggle('dark', SYSTEM_THEME.matches);
};

applySystemTheme();
if (SYSTEM_THEME.addEventListener) {
    SYSTEM_THEME.addEventListener('change', applySystemTheme);
} else {
    SYSTEM_THEME.addListener(applySystemTheme);
}

store.dispatch('fetchUserConfig').then(() => {
    app.use(store).use(router).use(ElementPlus).use(i18n).mount('#app');
}).catch(error => {
    console.error('Failed to load user configuration:', error);
    app.use(store).use(router).use(ElementPlus).use(i18n).use(head).mount('#app');
})
