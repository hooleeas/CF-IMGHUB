/**
 * 数据库适配器
 * 提供统一的接口，可以在KV和D1之间切换
 */

import { D1Database } from './d1Database.js';
import {
    deleteSystemConfigCategory,
    getSystemConfigStorageKeys,
    readSystemConfig,
    writeSystemConfigCategory,
} from './sysConfigStorage.js';

const IMAGE_KEY_PREFIX = 'IMG_';
export const DATABASE_PROVIDER_KEY = 'manage@system@databaseProvider';
const IMAGE_KEY_PATTERN = /^IMG_[A-Z0-9]{20}$/;
const IMAGE_ID_LENGTH = 20;
const IMAGE_ID_SPACE = 36n ** BigInt(IMAGE_ID_LENGTH);
const CHANNEL_GROUPS = {
    CloudflareR2: 'cfr2',
    R2: 'cfr2',
    S3: 's3',
    Telegram: 'telegram',
    TelegramNew: 'telegram',
    Discord: 'discord',
    HuggingFace: 'huggingface',
    WebDAV: 'webdav',
};
const CHANNEL_TYPES = {
    cfr2: 'CloudflareR2',
    s3: 'S3',
    telegram: 'TelegramNew',
    discord: 'Discord',
    huggingface: 'HuggingFace',
    webdav: 'WebDAV',
};
const IMAGE_FIELDS = {
    FILE_NAME: 'FileName',
    FILE_SIZE: 'FileSizeBytes',
    CHANNEL: 'ChannelId',
    URL: 'ExternalLink',
    CONTENT: 'Content',
    S3_FILE_KEY: 'S3FileKey',
    TG_FILE_ID: 'TgFileId',
    DISCORD_MESSAGE_ID: 'DiscordMessageId',
    HF_FILE_PATH: 'HfFilePath',
    WEBDAV_FILE_PATH: 'WebDAVFilePath',
    IS_CHUNKED: 'IsChunked',
    TOTAL_CHUNKS: 'TotalChunks',
    WIDTH: 'Width',
    HEIGHT: 'Height',
    LIST_TYPE: 'ListType',
    LABEL: 'Label',
    TAGS: 'Tags',
};
const IMAGE_METADATA_ALIASES = {
    S3_FILE_KEY: 'S3FileKey',
    HF_FILE_PATH: 'HfFilePath',
    TG_FILE_ID: 'TgFileId',
    WEBDAV_FILE_PATH: 'WebDAVFilePath',
    WEB_DAV_FILE_PATH: 'WebDAVFilePath',
};
const IMAGE_FIELD_NAMES = Object.fromEntries(
    Object.entries(IMAGE_FIELDS).map(([storedName, metadataName]) => [metadataName, storedName])
);

async function imageKey(fileId) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(fileId)
    ));
    let value = 0n;
    for (let index = 0; index < 13; index++) {
        value = (value << 8n) | BigInt(digest[index]);
    }
    return `${IMAGE_KEY_PREFIX}${(value % IMAGE_ID_SPACE).toString(36).toUpperCase().padStart(IMAGE_ID_LENGTH, '0')}`;
}

function inferImageType(fileName) {
    const extension = String(fileName).split('.').pop()?.toLowerCase();
    return ({
        avif: 'image/avif',
        bmp: 'image/bmp',
        gif: 'image/gif',
        ico: 'image/x-icon',
        jfif: 'image/jpeg',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        svg: 'image/svg+xml',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        webp: 'image/webp',
    })[extension] || 'application/octet-stream';
}

function isImageMetadata(metadata) {
    return typeof metadata?.FileType === 'string'
        && metadata.FileType.toLowerCase().startsWith('image/');
}

function parseImageRecord(value, key) {
    let record;
    try {
        record = JSON.parse(value);
    } catch (error) {
        throw new Error(`图片 KV 记录“${key}”不是有效的 JSON。`, { cause: error });
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error(`图片 KV 记录“${key}”格式无效。`);
    }

    const metadata = {};
    for (const [storedName, fieldValue] of Object.entries(record)) {
        if (storedName === 'CONTENT' || storedName === 'CHANNEL_TYPE' || storedName === 'CHANNEL_NAME') continue;
        const metadataName = IMAGE_FIELDS[storedName] || IMAGE_METADATA_ALIASES[storedName];
        if (!metadataName) continue;
        metadata[metadataName] = fieldValue;
    }
    metadata.FileType ||= inferImageType(metadata.FileName);
    if (metadata.ChannelId === 'EXTERNAL') metadata.Channel = 'External';
    if (metadata.FileSizeBytes !== undefined) {
        metadata.FileSize = (Number(metadata.FileSizeBytes) / 1024 / 1024).toFixed(2);
    }

    return {
        value: record.CONTENT ?? '',
        metadata,
    };
}

function toImageRecord(fileId, value, metadata, channelId) {
    const record = {};
    for (const metadataName of [
        'S3FileKey', 'TgFileId', 'DiscordMessageId', 'HfFilePath',
        'WebDAVFilePath', 'IsChunked', 'TotalChunks', 'Width', 'Height',
        'ListType', 'Label', 'Tags',
    ]) {
        const fieldValue = metadata?.[metadataName];
        if (fieldValue === undefined || fieldValue === null) continue;
        record[IMAGE_FIELD_NAMES[metadataName]] = fieldValue;
    }

    const sizeBytes = Number(metadata?.FileSizeBytes)
        || Math.round((Number.parseFloat(metadata?.FileSize) || 0) * 1024 * 1024);
    record.FILE_NAME = fileId;
    record.FILE_SIZE = sizeBytes;
    record.CHANNEL = metadata?.Channel === 'External'
        ? 'EXTERNAL'
        : channelId || metadata?.ChannelId || '';
    if (metadata?.Channel === 'External' && metadata.ExternalLink) {
        record.URL = metadata.ExternalLink;
    }
    if (value !== null && value !== undefined && value !== '') {
        record.CONTENT = value;
    }
    return record;
}

/**
 * 创建数据库适配器
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库适配器实例
 */
export function createDatabaseAdapter(env) {
    // 检查是否配置了数据库
    if (env.KV && typeof env.KV.get === 'function') {
        // 使用KV存储
        return new KVAdapter(env.KV, env);
    } else if (env.D1 && typeof env.D1.prepare === 'function') {
        // 使用D1数据库
        return new D1Database(env.D1);
    } else {
        console.error('No database configured. Please configure either KV (env.KV) or D1 (env.D1).');
        return null;
    }
}

export function hasKVDatabase(env) {
    return Boolean(env?.KV && typeof env.KV.get === 'function');
}

export function hasD1Database(env) {
    return Boolean(env?.D1 && typeof env.D1.prepare === 'function');
}

export async function getActiveDatabaseType(env) {
    const hasKV = hasKVDatabase(env);
    const hasD1 = hasD1Database(env);
    if (!hasKV && !hasD1) return null;
    if (hasKV) {
        const selected = await env.KV.get(DATABASE_PROVIDER_KEY);
        if (selected === 'KV') return 'KV';
        if (selected === 'D1' && hasD1) return 'D1';
    }
    if (hasD1) {
        try {
            const d1 = new D1Database(env.D1);
            const selected = await d1.getSetting(DATABASE_PROVIDER_KEY);
            if (selected === 'D1') return 'D1';
            if (selected === 'KV' && hasKV) return 'KV';
        } catch (error) {
            if (!hasKV) throw error;
            console.error('Could not read the D1 database selector; using KV fallback:', error);
        }
    }
    // Both bindings with no marker means first deployment: KV is the default.
    const defaultType = hasKV ? 'KV' : 'D1';
    if (hasD1) {
        try {
            await setActiveDatabaseType(env, defaultType);
        } catch (error) {
            console.error(`Could not persist the initial ${defaultType} database selection:`, error);
        }
    }
    return defaultType;
}

export async function isUsingD1Database(env) {
    return (await getActiveDatabaseType(env)) === 'D1';
}

export async function setActiveDatabaseType(env, type) {
    if (type === 'KV' && !hasKVDatabase(env)) throw new Error('未绑定 KV 数据库。');
    if (type === 'D1' && !hasD1Database(env)) throw new Error('未绑定 D1 数据库。');
    // Update both selectors before deleting the old store. KV is checked first,
    // so writing D1 first leaves the old backend active until the KV marker lands.
    if (hasD1Database(env)) await new D1Database(env.D1).putSetting(DATABASE_PROVIDER_KEY, type, 'SYSTEM');
    if (hasKVDatabase(env)) await env.KV.put(DATABASE_PROVIDER_KEY, type);
}

/**
 * KV适配器类
 * 保持与原有KV接口的兼容性
 */
class KVAdapter {
    constructor(kv, env) {
        this.kv = kv;
        this.env = env;
        this.systemConfigPromise = null;
    }

    async resolveChannelId(metadata = {}) {
        if (metadata.Channel === 'External') return 'EXTERNAL';
        if (metadata.ChannelId) return metadata.ChannelId;
        const group = CHANNEL_GROUPS[metadata.Channel];
        if (!group) return '';

        if (!this.systemConfigPromise) {
            this.systemConfigPromise = readSystemConfig(
                this.kv.get.bind(this.kv),
                this.kv.put.bind(this.kv),
                this.kv.delete.bind(this.kv)
            );
        }
        const config = await this.systemConfigPromise;
        const channels = config.upload?.[group]?.channels || [];
        const channel = channels.find((item) => item.name === metadata.ChannelName);
        if (channel?.id) return channel.id;
        if (!metadata.ChannelName && channels.length === 1 && channels[0].id) {
            return channels[0].id;
        }
        const environmentChannelIds = {
            telegram: this.env.TG_BOT_TOKEN ? 'TGAAA' : '',
            s3: this.env.S3_ACCESS_KEY_ID ? 'S3AAA' : '',
        };
        if (metadata.ChannelName === 'Telegram_env' || metadata.ChannelName === 'S3_env') {
            return environmentChannelIds[group] || '';
        }
        throw new Error(`无法根据“${metadata.ChannelName || metadata.Channel}”解析上传渠道 ID。`);
    }

    async migrateLegacyImage(fileId, legacyRecord) {
        if (!isImageMetadata(legacyRecord?.metadata)) {
            return legacyRecord;
        }
        const channelId = await this.resolveChannelId(legacyRecord.metadata);
        const newKey = await imageKey(fileId);
        const serializedRecord = JSON.stringify(toImageRecord(
            fileId,
            legacyRecord.value,
            legacyRecord.metadata,
            channelId
        ));
        const existingRecord = await this.kv.get(newKey);
        if (existingRecord !== null && existingRecord !== serializedRecord) {
            throw new Error(`图片迁移目标“${newKey}”已存在且内容不同，已保留旧记录。`);
        }
        if (existingRecord === null) {
            await this.kv.put(newKey, serializedRecord);
        }
        await this.kv.delete(fileId);
        return {
            value: legacyRecord.value ?? '',
            metadata: await this.restoreImageMetadata(parseImageRecord(serializedRecord, newKey).metadata),
        };
    }

    async restoreImageMetadata(metadata) {
        const restored = { ...metadata };
        if (restored.ChannelId === 'EXTERNAL') {
            restored.Channel = 'External';
            return restored;
        }
        if (!restored.ChannelId) return restored;

        if (!this.systemConfigPromise) {
            this.systemConfigPromise = readSystemConfig(
                this.kv.get.bind(this.kv),
                this.kv.put.bind(this.kv),
                this.kv.delete.bind(this.kv)
            );
        }
        const config = await this.systemConfigPromise;
        const channelEntry = Object.entries(config.upload || {}).flatMap(([group, setting]) =>
            (setting.channels || [])
                .filter((channel) => channel.id === restored.ChannelId)
                .map((channel) => ({ group, channel }))
        )[0];
        const group = channelEntry?.group || {
            TGAAA: 'telegram',
            S3AAA: 's3',
        }[restored.ChannelId];
        restored.Channel = group === 'telegram'
            ? (restored.TgFileId || restored.IsChunked ? 'TelegramNew' : 'Telegram')
            : CHANNEL_TYPES[group];
        if (channelEntry) restored.ChannelName = channelEntry.channel.name;
        if (!restored.Channel) {
            throw new Error(`无法根据渠道 ID“${restored.ChannelId}”解析上传渠道。`);
        }
        return restored;
    }

    async migrateLegacyImageKey(key, value) {
        const legacyRecord = parseImageRecord(value, key);
        const legacyFields = JSON.parse(value);
        const fileId = legacyRecord.metadata.FileName || key.slice(IMAGE_KEY_PREFIX.length);
        const metadata = {
            ...legacyRecord.metadata,
            FileName: fileId,
            Channel: legacyFields.CHANNEL_TYPE || legacyRecord.metadata.Channel,
            ChannelName: legacyFields.CHANNEL_NAME,
            ChannelId: legacyFields.CHANNEL,
            ExternalLink: legacyFields.EXTERNAL_LINK
                || (legacyFields.CHANNEL_TYPE === 'External' ? legacyFields.URL : undefined),
        };
        const channelId = await this.resolveChannelId(metadata);
        const newKey = await imageKey(fileId);
        const serializedRecord = JSON.stringify(toImageRecord(fileId, legacyRecord.value, metadata, channelId));
        const currentValue = await this.kv.get(newKey);
        if (currentValue !== null && currentValue !== serializedRecord) {
            throw new Error(`图片迁移目标“${newKey}”已存在且内容不同，已保留旧记录。`);
        }
        if (currentValue === null) await this.kv.put(newKey, serializedRecord);
        await this.kv.delete(key);
        return {
            name: fileId,
            metadata: await this.restoreImageMetadata(parseImageRecord(serializedRecord, newKey).metadata),
        };
    }

    async migrateLegacyImages() {
        let cursor;
        let scanned = 0;
        let migrated = 0;
        let failed = 0;
        const failures = [];

        do {
            const page = await this.kv.list({
                limit: 100,
                ...(cursor ? { cursor } : {}),
            });
            for (let offset = 0; offset < page.keys.length; offset += 10) {
                const batch = page.keys.slice(offset, offset + 10);
                await Promise.all(batch.map(async ({ name }) => {
                    if (name === 'IMGS' || name.startsWith('manage@')) {
                        return;
                    }
                    try {
                        if (name.startsWith(IMAGE_KEY_PREFIX)) {
                            if (IMAGE_KEY_PATTERN.test(name)) return;
                            const legacyValue = await this.kv.get(name);
                            if (legacyValue === null) return;
                            scanned++;
                            await this.migrateLegacyImageKey(name, legacyValue);
                            migrated++;
                            return;
                        }
                        const legacyRecord = await this.kv.getWithMetadata(name);
                        if (!isImageMetadata(legacyRecord?.metadata)) return;
                        scanned++;
                        await this.migrateLegacyImage(name, legacyRecord);
                        migrated++;
                    } catch (error) {
                        failed++;
                        if (failures.length < 50) {
                            failures.push({ key: name, error: error.message || String(error) });
                        }
                        console.error(`Failed to migrate legacy image KV record "${name}":`, error);
                    }
                }));
            }
            cursor = page.list_complete ? null : page.cursor || null;
        } while (cursor);

        return { scanned, migrated, failed, failures };
    }

    // 直接代理到KV的方法
    async put(key, value, options) {
        options = options || {};
        const configKeys = getSystemConfigStorageKeys(key);
        if (configKeys) {
            return await writeSystemConfigCategory(
                this.kv.get.bind(this.kv),
                (storageKey, storageValue) => this.kv.put(storageKey, storageValue, options),
                this.kv.delete.bind(this.kv),
                configKeys.category,
                value
            );
        }
        if (isImageMetadata(options.metadata)) {
            const channelId = await this.resolveChannelId(options.metadata);
            const imageStorageKey = await imageKey(key);
            const currentValue = await this.kv.get(imageStorageKey);
            if (currentValue !== null && parseImageRecord(currentValue, imageStorageKey).metadata.FileName !== key) {
                throw new Error(`图片 ID“${key}”与现有 KV 图片记录冲突。`);
            }
            await this.kv.put(
                imageStorageKey,
                JSON.stringify(toImageRecord(key, value, options.metadata, channelId)),
                {}
            );
            await this.kv.delete(`${IMAGE_KEY_PREFIX}${key}`);
            await this.kv.delete(key);
            return;
        }
        return await this.kv.put(key, value, options);
    }

    async get(key, options) {
        options = options || {};
        const configKeys = getSystemConfigStorageKeys(key);
        if (configKeys) {
            const config = await readSystemConfig(
                this.kv.get.bind(this.kv),
                (storageKey, storageValue) => this.kv.put(storageKey, storageValue, options),
                this.kv.delete.bind(this.kv)
            );
            return Object.hasOwn(config, configKeys.category)
                ? JSON.stringify(config[configKeys.category])
                : null;
        }
        const record = await this.getWithMetadata(key, options);
        return record?.value ?? null;
    }

    async getWithMetadata(key, options) {
        options = options || {};
        const configKeys = getSystemConfigStorageKeys(key);
        if (configKeys) {
            const value = await this.get(key, options);
            return value === null ? null : { value, metadata: {} };
        }
        const imageStorageKey = await imageKey(key);
        const imageValue = await this.kv.get(imageStorageKey, options);
        if (imageValue !== null) {
            const record = parseImageRecord(imageValue, imageStorageKey);
            record.metadata = await this.restoreImageMetadata(record.metadata);
            return record;
        }
        const oldImageKey = `${IMAGE_KEY_PREFIX}${key}`;
        const oldImageValue = await this.kv.get(oldImageKey, options);
        if (oldImageValue !== null && !IMAGE_KEY_PATTERN.test(oldImageKey)) {
            const migrated = await this.migrateLegacyImageKey(oldImageKey, oldImageValue);
            return await this.getWithMetadata(migrated.name, options);
        }
        if (typeof this.kv.getWithMetadata !== 'function') {
            const value = await this.kv.get(key, options);
            return value === null ? null : { value, metadata: null };
        }
        const legacyRecord = await this.kv.getWithMetadata(key, options);
        return this.migrateLegacyImage(key, legacyRecord);
    }

    async delete(key, options) {
        options = options || {};
        const configKeys = getSystemConfigStorageKeys(key);
        if (configKeys) {
            return await deleteSystemConfigCategory(
                this.kv.get.bind(this.kv),
                (storageKey, storageValue) => this.kv.put(storageKey, storageValue, options),
                this.kv.delete.bind(this.kv),
                configKeys.category
            );
        }
        await this.kv.delete(await imageKey(key), options);
        await this.kv.delete(`${IMAGE_KEY_PREFIX}${key}`, options);
        return await this.kv.delete(key, options);
    }

    async list(options) {
        options = options || {};
        const result = await this.kv.list(options);
        const mapped = await Promise.all(result.keys.map(async (item) => {
            if (item.name.startsWith(IMAGE_KEY_PREFIX)) {
                const value = await this.kv.get(item.name);
                if (value === null) return null;
                if (!IMAGE_KEY_PATTERN.test(item.name)) {
                    return await this.migrateLegacyImageKey(item.name, value);
                }
                const record = parseImageRecord(value, item.name);
                record.metadata = await this.restoreImageMetadata(record.metadata);
                return {
                    ...item,
                    name: record.metadata.FileName,
                    metadata: record.metadata,
                };
            }
            if (item.name === 'IMGS') return null;
            if (typeof this.kv.getWithMetadata !== 'function') return item;
            const legacyRecord = await this.kv.getWithMetadata(item.name);
            if (isImageMetadata(legacyRecord?.metadata)) {
                const migrated = await this.migrateLegacyImage(item.name, legacyRecord);
                return { ...item, metadata: migrated.metadata };
            }
            return item;
        }));
        return { ...result, keys: mapped.filter(Boolean) };
    }

    async getRaw(key, options) {
        return await this.kv.get(key, options);
    }

    async deleteRaw(key, options) {
        return await this.kv.delete(key, options);
    }

    // 为了兼容性，添加一些别名方法
    async putFile(fileId, value, options) {
        return await this.put(fileId, value, options);
    }

    async getFile(fileId, options) {
        const result = await this.getWithMetadata(fileId, options);
        return result;
    }

    async getFileWithMetadata(fileId, options) {
        return await this.getWithMetadata(fileId, options);
    }

    async deleteFile(fileId, options) {
        return await this.delete(fileId, options);
    }

    async listFiles(options) {
        return await this.list(options);
    }

    async putSetting(key, value, options) {
        return await this.put(key, value, options);
    }

    async getSetting(key, options) {
        return await this.get(key, options);
    }

    async deleteSetting(key, options) {
        return await this.delete(key, options);
    }

    async listSettings(options) {
        return await this.list(options);
    }

    async putIndexOperation() {
        return;
    }

    async getIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        const result = await this.get(key, options);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        return await this.delete(key, options);
    }

    async listIndexOperations(options) {
        const listOptions = Object.assign({}, options, {
            prefix: 'manage@index@operation_'
        });
        const result = await this.list(listOptions);
        
        // 转换格式以匹配D1Database的返回格式
        const operations = [];
        for (const item of result.keys) {
            const operationData = await this.get(item.name);
            if (operationData) {
                const operation = JSON.parse(operationData);
                operations.push({
                    id: item.name.replace('manage@index@operation_', ''),
                    type: operation.type,
                    timestamp: operation.timestamp,
                    data: operation.data,
                    processed: false // KV中没有这个字段，默认为false
                });
            }
        }
        
        return operations;
    }
}

/**
 * 获取数据库实例的便捷函数
 * 这个函数可以在整个应用中使用，确保一致的数据库访问
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库实例
 */
export function getDatabase(env) {
    if (!hasKVDatabase(env) && !hasD1Database(env)) {
        throw new Error('Database not configured. Please configure D1 database (env.D1) or KV storage (env.KV).');
    }
    return new Proxy({}, {
        get(_target, property) {
            if (property === 'then') return undefined;
            return (...args) => getActiveDatabaseType(env).then((type) => {
                const adapter = type === 'D1'
                    ? new D1Database(env.D1)
                    : new KVAdapter(env.KV, env);
                const method = adapter[property];
                if (typeof method !== 'function') throw new Error(`Unsupported database method: ${String(property)}`);
                return method.apply(adapter, args);
            });
        },
    });
}

/**
 * 检查数据库配置
 * @param {Object} env - 环境变量
 * @returns {Object} 配置信息
 */
export function checkDatabaseConfig(env) {
    var hasD1 = hasD1Database(env);
    var hasKV = hasKVDatabase(env);

    return {
        hasD1: hasD1,
        hasKV: hasKV,
        usingD1: !hasKV && hasD1,
        usingKV: hasKV,
        configured: hasD1 || hasKV
    };
}
