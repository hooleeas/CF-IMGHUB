export const SYSTEM_CONFIG_CATEGORIES = ['site', 'upload', 'security', 'page', 'others'];
export const SYSTEM_CONFIG_KEY = 'CONFIG';
const PAGE_SETTING_FIELDS = {
    defaultChannelId: 'channelId',
    defaultConvertToWebp: 'convertToWebp',
    defaultCustomerCompress: 'customerCompress',
    defaultCompressBar: 'compressBar',
    defaultCompressQuality: 'compressQuality',
};
const DEFAULT_PAGE_SETTINGS = {
    channelId: '',
    convertToWebp: false,
    customerCompress: true,
    compressBar: 5,
    compressQuality: 4,
};
const DEFAULT_OTHER_SETTINGS = {
    cloudflareApiToken: {
        CF_ZONE_ID: '',
        CF_EMAIL: '',
        CF_API_KEY: '',
    },
    webDAV: {
        enabled: false,
        username: '',
        password: '',
        uploadChannel: '',
        channelName: '',
        internalToken: '',
        internalTokenId: '',
    },
};
const CHANNEL_TYPES = {
    telegram: 'Telegram',
    cfr2: 'R2',
    s3: 'S3',
    discord: 'Discord',
    huggingface: 'HuggingFace',
    webdav: 'WebDAV',
};
const CHANNEL_TYPE_KEYS = Object.fromEntries(
    Object.entries(CHANNEL_TYPES).map(([key, value]) => [value.toLowerCase(), key])
);
const SNAKE_CASE_FIELDS = new Set(['label_en', 'tooltip_en', 'category_en']);
const UPPERCASE_FIELDS = new Set([
    'CF_ZONE_ID',
    'CF_EMAIL',
    'CF_API_KEY',
    'TG_BOT_TOKEN',
    'TG_CHAT_ID',
    'TG_PROXY_URL',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
]);

export function getSystemConfigStorageKeys(key) {
    const match = /^manage@sysConfig@(site|upload|security|page|others)$/i.exec(key);
    if (!match || !SYSTEM_CONFIG_CATEGORIES.includes(match[1].toLowerCase())) {
        return null;
    }

    const category = match[1].toLowerCase();
    return {
        storageKey: SYSTEM_CONFIG_KEY,
        category,
        legacyStorageKey: `MANAGE@SYSCONFIG@${category.toUpperCase()}`,
        legacyKey: `manage@sysConfig@${category}`,
    };
}

export function parseSystemConfig(value, encoded = true) {
    if (value === null || value === undefined) return {};
    const parsed = JSON.parse(value);
    const decoded = encoded ? decodeSystemConfigValue(parsed) : parsed;
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded : {};
}

export async function readSystemConfig(get, put, deleteKey) {
    const storedValue = await get(SYSTEM_CONFIG_KEY);
    const config = storedValue === null ? {} : parseSystemConfig(storedValue);
    let foundLegacyConfig = false;
    const legacyKeysToDelete = [];
    for (const category of SYSTEM_CONFIG_CATEGORIES) {
        const keys = getSystemConfigStorageKeys(`manage@sysConfig@${category}`);
        let legacyValue = await get(keys.legacyStorageKey);
        let shouldDeleteLegacyKey = keys.legacyStorageKey;
        let isEncoded = true;
        if (legacyValue === null) {
            legacyValue = await get(keys.legacyKey);
            shouldDeleteLegacyKey = keys.legacyKey;
            isEncoded = false;
        }
        if (legacyValue === null) continue;

        foundLegacyConfig = true;
        if (!Object.hasOwn(config, category)) {
            config[category] = parseSystemConfig(legacyValue, isEncoded);
        }
        legacyKeysToDelete.push(keys.legacyStorageKey, keys.legacyKey);
    }

    const addedDefaults = seedBaseSystemConfig(config);
    const changedChannelIds = normalizeChannelIds(config);
    const parsedStoredValue = storedValue === null ? null : JSON.parse(storedValue);
    const needsStorageMigration = storedValue !== null
        && (!isFlatSystemConfig(parsedStoredValue) || hasLegacyOtherSettings(parsedStoredValue));
    if (foundLegacyConfig || addedDefaults || changedChannelIds || needsStorageMigration) {
        await put(SYSTEM_CONFIG_KEY, encodeSystemConfigValue(config));
    }
    if (foundLegacyConfig) {
        await Promise.all(legacyKeysToDelete.map(deleteKey));
    }
    return config;
}

function seedBaseSystemConfig(config) {
    let changed = false;

    const site = config.site && typeof config.site === 'object' && !Array.isArray(config.site)
        ? config.site
        : (config.site = {});
    for (const [key, value] of Object.entries({ adminPath: '/admin', siteName: 'cf-imghub' })) {
        if (!Object.hasOwn(site, key)) {
            site[key] = value;
            changed = true;
        }
    }

    const security = config.security && typeof config.security === 'object' && !Array.isArray(config.security)
        ? config.security
        : (config.security = {});
    security.auth = security.auth && typeof security.auth === 'object' && !Array.isArray(security.auth)
        ? security.auth
        : (security.auth = {});
    security.auth.admin = security.auth.admin
        && typeof security.auth.admin === 'object'
        && !Array.isArray(security.auth.admin)
        ? security.auth.admin
        : (security.auth.admin = {});
    for (const [key, value] of Object.entries({ adminUsername: '', adminPassword: '' })) {
        if (!Object.hasOwn(security.auth.admin, key)) {
            security.auth.admin[key] = value;
            changed = true;
        }
    }

    const page = config.page && typeof config.page === 'object' && !Array.isArray(config.page)
        ? config.page
        : (config.page = {});
    const others = config.others && typeof config.others === 'object' && !Array.isArray(config.others)
        ? config.others
        : (config.others = {});
    for (const [key, defaults] of Object.entries(DEFAULT_OTHER_SETTINGS)) {
        const current = others[key] && typeof others[key] === 'object' && !Array.isArray(others[key])
            ? others[key]
            : (others[key] = {});
        for (const [field, value] of Object.entries(defaults)) {
            if (!Object.hasOwn(current, field)) {
                current[field] = value;
                changed = true;
            }
        }
    }
    const legacySettings = Array.isArray(page.config) ? page.config : [];
    const remainingSettings = [];
    for (const setting of legacySettings) {
        const field = PAGE_SETTING_FIELDS[setting?.id];
        if (field) {
            if (!Object.hasOwn(page, field) && Object.hasOwn(setting, 'value')) {
                page[field] = setting.value;
            }
            changed = true;
        } else {
            remainingSettings.push(setting);
        }
    }
    if (remainingSettings.length) {
        if (!Array.isArray(page.config) || remainingSettings.length !== legacySettings.length) {
            page.config = remainingSettings;
            changed = true;
        }
    } else if (Object.hasOwn(page, 'config')) {
        delete page.config;
        changed = true;
    }
    for (const [field, value] of Object.entries(DEFAULT_PAGE_SETTINGS)) {
        if (!Object.hasOwn(page, field)) {
            page[field] = value;
            changed = true;
        }
    }

    return changed;
}

function normalizeChannelIds(config) {
    let changed = false;
    const remappedIds = new Map();
    const usedIds = new Set();

    for (const channels of Object.values(config.upload || {})) {
        if (!Array.isArray(channels?.channels)) continue;
        for (const channel of channels.channels) {
            if (!channel || typeof channel !== 'object') continue;
            let id = channel.id;
            if (typeof id !== 'string' || !/^[A-Z]{5}$/.test(id) || usedIds.has(id)) {
                const oldId = id;
                id = createChannelId(usedIds);
                if (typeof oldId === 'string' && oldId) remappedIds.set(oldId, id);
                channel.id = id;
                changed = true;
            } else {
                usedIds.add(id);
            }
        }
    }

    const page = config.page;
    if (page && remappedIds.has(page.channelId)) {
        page.channelId = remappedIds.get(page.channelId);
        changed = true;
    }
    return changed;
}

function createChannelId(usedIds) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const bytes = new Uint8Array(5);
        globalThis.crypto.getRandomValues(bytes);
        const id = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
        if (!usedIds.has(id)) {
            usedIds.add(id);
            return id;
        }
    }
    throw new Error('无法生成唯一的渠道 ID。');
}

function isFlatSystemConfig(value) {
    return Boolean(value && typeof value === 'object'
        && value.SITE && Object.hasOwn(value.SITE, 'NAME')
        && value.ADMIN && value.UPLOAD && Array.isArray(value.CHANNELS));
}

function hasLegacyOtherSettings(value) {
    const others = value?.OTHERS;
    const cloudflareApiToken = value?.CLOUDFLARE_API_TOKEN;
    return Boolean((others && typeof others === 'object'
        && (Object.hasOwn(others, 'CLOUDFLARE_API_TOKEN') || Object.hasOwn(others, 'WEB_DAV')))
        || (cloudflareApiToken && typeof cloudflareApiToken === 'object'
            && (Object.hasOwn(cloudflareApiToken, 'FIXED') || Object.hasOwn(cloudflareApiToken, 'fixed'))));
}

function toFlatSystemConfig(config) {
    const site = config.site || {};
    const security = structuredClone(config.security || {});
    const admin = security.auth?.admin || {};
    if (security.auth) {
        delete security.auth.admin;
        if (!Object.keys(security.auth).length) delete security.auth;
    }

    const page = config.page || {};
    const uploadSettings = config.upload || {};
    const channels = [];
    const loadBalance = {};
    const channelIdsByName = new Map();
    for (const [type, typeSettings] of Object.entries(uploadSettings)) {
        const channelType = CHANNEL_TYPES[type];
        if (!channelType || !typeSettings || typeof typeSettings !== 'object') continue;
        for (const channel of Array.isArray(typeSettings.channels) ? typeSettings.channels : []) {
            if (!channel || typeof channel !== 'object') continue;
            if (channel.fixed === true
                || (channel.savePath ?? channel.savepath) === 'environment variable') continue;
            channelIdsByName.set(`${type}:${channel.name}`, channel.id);
            const { id, ...details } = channel;
            delete details.type;
            delete details.fixed;
            delete details.savePath;
            delete details.savepath;
            if (['cfr2', 's3', 'webdav'].includes(type)) delete details.quota;
            channels.push({ id, channel: channelType, ...details });
        }
        const balance = typeSettings.loadBalance;
        if (balance && (balance.enabled === true || (balance.channels?.length ?? 0) > 0)) {
            loadBalance[channelType] = balance;
        }
    }

    let selectedChannel = page.channelId ?? '';
    if (!selectedChannel) {
        const legacyConfig = Array.isArray(page.config) ? page.config : [];
        const legacyType = legacyConfig.find(({ id }) => id === 'defaultUploadChannel')?.value;
        const legacyName = legacyConfig.find(({ id }) => id === 'defaultChannelName')?.value;
        if (legacyType && legacyName) {
            selectedChannel = channelIdsByName.get(`${legacyType}:${legacyName}`) || '';
        }
    }
    const upload = {
        selectChannel: selectedChannel,
        convertToWebp: page.convertToWebp ?? DEFAULT_PAGE_SETTINGS.convertToWebp,
        compress: page.customerCompress ?? DEFAULT_PAGE_SETTINGS.customerCompress,
        compressBar: page.compressBar ?? DEFAULT_PAGE_SETTINGS.compressBar,
        compressQuality: page.compressQuality ?? DEFAULT_PAGE_SETTINGS.compressQuality,
    };
    if (Object.keys(loadBalance).length) upload.loadBalance = loadBalance;

    const others = config.others || {};
    const cloudflareApiToken = others.cloudflareApiToken || DEFAULT_OTHER_SETTINGS.cloudflareApiToken;
    const flat = {
        site: {
            name: site.siteName ?? 'cf-imghub',
            adminPath: String(site.adminPath ?? '/admin').replace(/^\/+|\/+$/g, '') || 'admin',
        },
        admin: {
            username: admin.adminUsername || '',
            password: admin.adminPassword || '',
        },
        upload,
        channels,
        cloudflareApiToken: Object.fromEntries(Object.entries(cloudflareApiToken)
            .filter(([key]) => key.toLowerCase() !== 'fixed')),
        webDAV: others.webDAV || DEFAULT_OTHER_SETTINGS.webDAV,
    };
    if (Object.keys(security).length) flat.security = security;
    const otherSettings = Object.fromEntries(Object.entries(others).filter(([key]) =>
        !Object.hasOwn(DEFAULT_OTHER_SETTINGS, key)
    ));
    if (Object.keys(otherSettings).length) flat.others = otherSettings;
    return flat;
}

function fromFlatSystemConfig(config) {
    if (!config || typeof config !== 'object' || !Array.isArray(config.channels)) return config;

    const site = config.site || {};
    const upload = config.upload || {};
    const security = config.security || {};
    const admin = config.admin || {};
    const others = { ...(config.others || {}) };
    if (config.cloudflareApiToken && typeof config.cloudflareApiToken === 'object') {
        others.cloudflareApiToken = Object.fromEntries(Object.entries(config.cloudflareApiToken)
            .filter(([key]) => key.toLowerCase() !== 'fixed'));
    }
    if (config.webDAV && typeof config.webDAV === 'object') {
        others.webDAV = config.webDAV;
    }
    const groupedChannels = {};
    for (const storedChannel of config.channels) {
        if (!storedChannel || typeof storedChannel !== 'object') continue;
        const channelType = CHANNEL_TYPE_KEYS[String(storedChannel.channel || '').toLowerCase()];
        if (!channelType) continue;
        const { channel: _channel, ...details } = storedChannel;
        const channels = groupedChannels[channelType] || (groupedChannels[channelType] = []);
        channels.push({ ...details, type: channelType });
    }

    for (const [channelName, settings] of Object.entries(upload.loadBalance || {})) {
        const type = CHANNEL_TYPE_KEYS[String(channelName).toLowerCase()];
        if (!type) continue;
        groupedChannels[type] = {
            ...(groupedChannels[type] || {}),
            loadBalance: settings,
        };
    }

    security.auth = security.auth || {};
    security.auth.admin = {
        ...(security.auth.admin || {}),
        adminUsername: admin.username || '',
        adminPassword: admin.password || '',
    };
    return {
        site: {
            siteName: site.name ?? site.siteName ?? 'cf-imghub',
            adminPath: `/${String(site.adminPath ?? '/admin').replace(/^\/+|\/+$/g, '') || 'admin'}`,
        },
        security,
        page: {
            channelId: upload.selectChannel ?? upload.channelId ?? '',
            convertToWebp: upload.convertToWebp ?? DEFAULT_PAGE_SETTINGS.convertToWebp,
            customerCompress: upload.compress ?? upload.customerCompress ?? DEFAULT_PAGE_SETTINGS.customerCompress,
            compressBar: upload.compressBar ?? DEFAULT_PAGE_SETTINGS.compressBar,
            compressQuality: upload.compressQuality ?? DEFAULT_PAGE_SETTINGS.compressQuality,
        },
        upload: Object.fromEntries(Object.entries(groupedChannels).map(([type, value]) => [
            type,
            Array.isArray(value) ? { channels: value } : value,
        ])),
        others,
    };
}

export async function writeSystemConfigCategory(get, put, deleteKey, category, value) {
    const config = await readSystemConfig(get, put, deleteKey);
    config[category] = typeof value === 'string' ? JSON.parse(value) : value;
    seedBaseSystemConfig(config);
    await put(SYSTEM_CONFIG_KEY, encodeSystemConfigValue(config));
    await deleteLegacySystemConfigCategory(deleteKey, category);
}

export async function deleteSystemConfigCategory(get, put, deleteKey, category) {
    const config = await readSystemConfig(get, put, deleteKey);
    delete config[category];
    seedBaseSystemConfig(config);
    if (Object.keys(config).length) {
        await put(SYSTEM_CONFIG_KEY, encodeSystemConfigValue(config));
    } else {
        await deleteKey(SYSTEM_CONFIG_KEY);
    }
    await deleteLegacySystemConfigCategory(deleteKey, category);
}

export async function deleteLegacySystemConfigCategory(deleteKey, category) {
    const keys = getSystemConfigStorageKeys(`manage@sysConfig@${category}`);
    await Promise.all([
        deleteKey(keys.legacyStorageKey),
        deleteKey(keys.legacyKey),
    ]);
}

export function encodeSystemConfigValue(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    let normalized = parsed;
    if (parsed && typeof parsed === 'object'
        && ['site', 'upload', 'security', 'page', 'others'].some((key) => Object.hasOwn(parsed, key))) {
        normalized = structuredClone(parsed);
        seedBaseSystemConfig(normalized);
        normalizeChannelIds(normalized);
        normalized = toFlatSystemConfig(normalized);
    }
    return JSON.stringify(transformKeys(normalized, 'encode', []));
}

export function decodeSystemConfigValue(value) {
    if (value === null || value === undefined) {
        return value;
    }

    const wasString = typeof value === 'string';
    const parsed = wasString ? JSON.parse(value) : value;
    const decoded = transformKeys(parsed, 'decode', []);
    const transformed = fromFlatSystemConfig(decoded);
    return wasString ? JSON.stringify(transformed) : transformed;
}

function transformKeys(value, direction, path) {
    if (Array.isArray(value)) {
        return value.map((item) => transformKeys(item, direction, path));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }

    const normalizedPath = path.map((key) => key.toLowerCase());
    const isTokenMap = normalizedPath.length >= 2
        && ['apitokens', 'api_tokens'].includes(normalizedPath[normalizedPath.length - 2])
        && normalizedPath[normalizedPath.length - 1] === 'tokens';
    const isHeaderMap = ['headers', 'customheaders'].includes(normalizedPath.at(-1));

    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        if (isTokenMap || isHeaderMap) {
            return [key, transformKeys(child, direction, [...path, key])];
        }

        const transformedKey = direction === 'encode'
            ? toUpperSnakeCase(key)
            : fromUpperSnakeCase(key);
        return [
            transformedKey,
            transformKeys(child, direction, [...path, transformedKey]),
        ];
    }));
}

function toUpperSnakeCase(key) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

function fromUpperSnakeCase(key) {
    if (SNAKE_CASE_FIELDS.has(key.toLowerCase())) {
        return key.toLowerCase();
    }
    if (UPPERCASE_FIELDS.has(key)) {
        return key;
    }
    if (key === 'WEB_DAV') {
        return 'webDAV';
    }
    return key.toLowerCase().replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase());
}
