import { getDatabase } from './databaseAdapter.js';

const SITE_CONFIG_KEY = 'manage@sysConfig@site';

export async function getSiteConfig(env) {
    const db = getDatabase(env);
    const configString = await db.get(SITE_CONFIG_KEY);
    const stored = configString ? JSON.parse(configString) : {};
    const storedSiteName = typeof stored.siteName === 'string' && stored.siteName.trim()
        ? stored.siteName.trim()
        : '';

    return {
        adminPath: normalizeAdminPath(stored.adminPath),
        siteName: ['ImgBed', 'ImgHub', 'Cloudflare ImgBed'].includes(storedSiteName)
            ? 'cf-imghub'
            : storedSiteName || 'cf-imghub',
    };
}

export async function saveSiteConfig(env, config) {
    const db = getDatabase(env);
    const normalized = {
        adminPath: normalizeAdminPath(config.adminPath),
        siteName: config.siteName,
    };
    await db.put(SITE_CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
}

export function normalizeAdminPath(path) {
    const segment = String(path || '').replace(/^\/+|\/+$/g, '');
    return /^[A-Za-z0-9_-]{1,128}$/.test(segment) ? `/${segment}` : '/admin';
}
