export const SYSTEM_CONFIG_CATEGORIES = ['site', 'upload', 'security', 'page', 'others'];
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
        storageKey: `MANAGE@SYSCONFIG@${category.toUpperCase()}`,
        legacyKey: `manage@sysConfig@${category}`,
    };
}

export function encodeSystemConfigValue(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(transformKeys(parsed, 'encode', []));
}

export function decodeSystemConfigValue(value) {
    if (value === null || value === undefined) {
        return value;
    }

    const wasString = typeof value === 'string';
    const parsed = wasString ? JSON.parse(value) : value;
    const transformed = transformKeys(parsed, 'decode', []);
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
