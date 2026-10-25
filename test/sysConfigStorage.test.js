import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as pageConfigHandler } from '../functions/api/manage/sysConfig/page.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { getSecurityConfig } from '../functions/utils/auth/securityConfig.js';
import {
    decodeSystemConfigValue,
    encodeSystemConfigValue,
} from '../functions/utils/sysConfigStorage.js';

function createKV(initialEntries = []) {
    const values = new Map(initialEntries);
    return {
        values,
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
        async list({ prefix = '' } = {}) {
            return {
                keys: [...values.keys()]
                    .filter((key) => key.startsWith(prefix))
                    .map((name) => ({ name })),
            };
        },
    };
}

function createD1Binding(rows) {
    return {
        prepare(sql) {
            return {
                bind(...values) {
                    return {
                        async first() {
                            if (!sql.startsWith('SELECT value FROM settings')) {
                                return null;
                            }
                            const value = rows.get(values[0]);
                            return value === undefined ? null : { value };
                        },
                        async run() {
                            if (sql.startsWith('INSERT OR REPLACE INTO settings')) {
                                rows.set(values[0], values[1]);
                            } else if (sql.startsWith('DELETE FROM settings')) {
                                rows.delete(values[0]);
                            }
                            return {};
                        },
                    };
                },
            };
        },
    };
}

const DEFAULT_STORED_CONFIG = {
    SITE: { NAME: 'cf-imghub', ADMIN_PATH: 'admin' },
    ADMIN: { USERNAME: '', PASSWORD: '' },
    UPLOAD: {
        SELECT_CHANNEL: '',
        CONVERT_TO_WEBP: false,
        COMPRESS: true,
        COMPRESS_BAR: 5,
        COMPRESS_QUALITY: 4,
    },
    CHANNELS: [],
    CLOUDFLARE_API_TOKEN: { CF_ZONE_ID: '', CF_EMAIL: '', CF_API_KEY: '' },
    WEB_DAV: {
        ENABLED: false,
        USERNAME: '',
        PASSWORD: '',
        UPLOAD_CHANNEL: '',
        CHANNEL_NAME: '',
        INTERNAL_TOKEN: '',
        INTERNAL_TOKEN_ID: '',
    },
};

test('encodes system config keys and fields while preserving dynamic key casing', () => {
    const config = {
        webDAV: {
            internalTokenId: 'AbC123',
            headers: { 'X-Auth-Email': 'user@example.com' },
        },
        apiTokens: {
            tokens: {
                AbC123: { createdAt: 'now', autoDelete: false },
            },
        },
    };

    const stored = JSON.parse(encodeSystemConfigValue(JSON.stringify(config)));
    assert.deepEqual(stored, {
        WEB_DAV: {
            INTERNAL_TOKEN_ID: 'AbC123',
            HEADERS: { 'X-Auth-Email': 'user@example.com' },
        },
        API_TOKENS: {
            TOKENS: {
                AbC123: { CREATED_AT: 'now', AUTO_DELETE: false },
            },
        },
    });
    assert.deepEqual(JSON.parse(decodeSystemConfigValue(JSON.stringify(stored))), config);
});

test('round-trips the flat site, admin, upload, and channel record shape', () => {
    const stored = {
        SITE: { NAME: 'cf-imghub', ADMIN_PATH: 'admin' },
        ADMIN: { USERNAME: 'owner', PASSWORD: 'password-hash' },
        UPLOAD: {
            SELECT_CHANNEL: 'ABCDE',
            CONVERT_TO_WEBP: true,
            COMPRESS: true,
            COMPRESS_BAR: 5,
            COMPRESS_QUALITY: 4,
        },
        CLOUDFLARE_API_TOKEN: {
            CF_ZONE_ID: 'zone-id',
            CF_EMAIL: 'owner@example.test',
            CF_API_KEY: 'api-secret',
        },
        WEB_DAV: {
            ENABLED: true,
            USERNAME: 'dav-user',
            PASSWORD: 'dav-password',
            UPLOAD_CHANNEL: 'ABCDE',
            CHANNEL_NAME: 'Primary',
            INTERNAL_TOKEN: 'dav-token',
            INTERNAL_TOKEN_ID: 'DVID1',
        },
        CHANNELS: [{
            ID: 'ABCDE',
            CHANNEL: 'R2',
            NAME: 'R2',
            PUBLIC_URL: '',
            ENABLED: true,
        }],
    };
    const decoded = JSON.parse(decodeSystemConfigValue(JSON.stringify(stored)));

    assert.deepEqual(decoded.site, { siteName: 'cf-imghub', adminPath: '/admin' });
    assert.deepEqual(decoded.security.auth.admin, {
        adminUsername: 'owner',
        adminPassword: 'password-hash',
    });
    assert.deepEqual(decoded.page, {
        channelId: 'ABCDE',
        convertToWebp: true,
        customerCompress: true,
        compressBar: 5,
        compressQuality: 4,
    });
    assert.deepEqual(decoded.others.cloudflareApiToken, {
        CF_ZONE_ID: 'zone-id',
        CF_EMAIL: 'owner@example.test',
        CF_API_KEY: 'api-secret',
    });
    assert.deepEqual(decoded.others.webDAV, {
        enabled: true,
        username: 'dav-user',
        password: 'dav-password',
        uploadChannel: 'ABCDE',
        channelName: 'Primary',
        internalToken: 'dav-token',
        internalTokenId: 'DVID1',
    });
    assert.deepEqual(decoded.upload.cfr2.channels, [{
        id: 'ABCDE',
        name: 'R2',
        publicUrl: '',
        enabled: true,
        type: 'cfr2',
    }]);
    assert.deepEqual(JSON.parse(encodeSystemConfigValue(decoded)), stored);
});

test('migrates Cloudflare API Token and WebDAV from legacy OTHERS into CONFIG root', async () => {
    const kv = createKV([['CONFIG', JSON.stringify({
        SITE: { NAME: 'cf-imghub', ADMIN_PATH: 'admin' },
        ADMIN: { USERNAME: '', PASSWORD: '' },
        UPLOAD: {
            SELECT_CHANNEL: '',
            CONVERT_TO_WEBP: false,
            COMPRESS: true,
            COMPRESS_BAR: 5,
            COMPRESS_QUALITY: 4,
        },
        CHANNELS: [],
        CLOUDFLARE_API_TOKEN: {
            FIXED: false,
            CF_ZONE_ID: 'zone-id',
            CF_EMAIL: 'owner@example.test',
            CF_API_KEY: 'api-secret',
        },
        OTHERS: {
            CLOUDFLARE_API_TOKEN: {
                CF_ZONE_ID: 'zone-id',
                CF_EMAIL: 'owner@example.test',
                CF_API_KEY: 'api-secret',
            },
            WEB_DAV: {
                ENABLED: true,
                USERNAME: 'dav-user',
                PASSWORD: 'dav-password',
            },
        },
    })]]);
    const db = getDatabase({ KV: kv });

    const settings = JSON.parse(await db.get('manage@sysConfig@others'));
    const stored = JSON.parse(kv.values.get('CONFIG'));

    assert.equal(settings.cloudflareApiToken.CF_ZONE_ID, 'zone-id');
    assert.equal(settings.webDAV.username, 'dav-user');
    assert.deepEqual(stored.CLOUDFLARE_API_TOKEN, {
        CF_ZONE_ID: 'zone-id',
        CF_EMAIL: 'owner@example.test',
        CF_API_KEY: 'api-secret',
    });
    assert.equal(stored.WEB_DAV.ENABLED, true);
    assert.equal(stored.WEB_DAV.USERNAME, 'dav-user');
    assert.equal(Object.hasOwn(stored, 'OTHERS'), false);
});

test('maps logical settings into the unified flat CONFIG layout', async () => {
    const kv = createKV();
    const db = getDatabase({ KV: kv });
    await db.put('manage@sysConfig@site', JSON.stringify({ siteName: 'Example', adminPath: '/panel/' }));
    await db.put('manage@sysConfig@security', JSON.stringify({
        auth: { admin: { adminUsername: 'root', adminPassword: 'hash' } },
        access: { sessionSecure: true },
    }));
    await db.put('manage@sysConfig@page', JSON.stringify({
        channelId: '',
        convertToWebp: true,
        customerCompress: false,
        compressBar: 8,
        compressQuality: 3,
    }));
    await db.put('manage@sysConfig@upload', JSON.stringify({
        webdav: { channels: [{
            id: 'ABCDE',
            type: 'WebDAV',
            name: 'Primary DAV',
            url: 'https://dav.example.test',
            enabled: true,
        }] },
    }));
    await db.put('manage@sysConfig@others', JSON.stringify({
        cloudflareApiToken: {
            fixed: false,
            CF_ZONE_ID: 'zone-id',
            CF_EMAIL: 'owner@example.test',
            CF_API_KEY: 'api-secret',
        },
        webDAV: {
            enabled: true,
            username: 'dav-user',
            password: 'dav-password',
            uploadChannel: 'ABCDE',
            channelName: 'Primary',
        },
    }));

    const stored = JSON.parse(kv.values.get('CONFIG'));
    assert.deepEqual(stored.SITE, { NAME: 'Example', ADMIN_PATH: 'panel' });
    assert.deepEqual(stored.ADMIN, { USERNAME: 'root', PASSWORD: 'hash' });
    assert.deepEqual(stored.UPLOAD, {
        SELECT_CHANNEL: '',
        CONVERT_TO_WEBP: true,
        COMPRESS: false,
        COMPRESS_BAR: 8,
        COMPRESS_QUALITY: 3,
    });
    assert.deepEqual(stored.CHANNELS, [{
        ID: 'ABCDE',
        CHANNEL: 'WebDAV',
        NAME: 'Primary DAV',
        URL: 'https://dav.example.test',
        ENABLED: true,
    }]);
    assert.deepEqual(stored.CLOUDFLARE_API_TOKEN, {
        CF_ZONE_ID: 'zone-id',
        CF_EMAIL: 'owner@example.test',
        CF_API_KEY: 'api-secret',
    });
    assert.deepEqual(stored.WEB_DAV, {
        ENABLED: true,
        USERNAME: 'dav-user',
        PASSWORD: 'dav-password',
        UPLOAD_CHANNEL: 'ABCDE',
        CHANNEL_NAME: 'Primary',
        INTERNAL_TOKEN: '',
        INTERNAL_TOKEN_ID: '',
    });
    assert.deepEqual(stored.SECURITY, { ACCESS: { SESSION_SECURE: true } });
    assert.equal(kv.values.has('MANAGE@SYSCONFIG@SITE'), false);
    assert.equal(kv.values.has('manage@sysConfig@site'), false);
    assert.equal(JSON.parse(await db.get('manage@sysConfig@security')).auth.admin.adminUsername, 'root');
    assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@others')).webDAV, {
        enabled: true,
        username: 'dav-user',
        password: 'dav-password',
        uploadChannel: 'ABCDE',
        channelName: 'Primary',
        internalToken: '',
        internalTokenId: '',
    });
});

test('seeds site, admin credential, and client compression defaults on first config read', async () => {
    const kv = createKV();
    const db = getDatabase({ KV: kv });

    assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@site')), {
        adminPath: '/admin',
        siteName: 'cf-imghub',
    });
    assert.deepEqual(JSON.parse(kv.values.get('CONFIG')), DEFAULT_STORED_CONFIG);
});

test('keeps environment admin credentials effective when CONFIG has blank bootstrap values', async () => {
    const db = getDatabase({ KV: createKV() });
    const settings = await getSecurityConfig(db, {
        BASIC_USER: 'deployed-admin',
        BASIC_PASS: 'deployed-secret',
    });

    assert.equal(settings.auth.admin.adminUsername, 'deployed-admin');
    assert.equal(settings.auth.admin.adminPassword, 'deployed-secret');
});

test('migrates legacy KV config categories into CONFIG and leaves unrelated keys untouched', async () => {
    const kv = createKV([
        ['manage@sysConfig@site', JSON.stringify({ siteName: 'Old', adminPath: '/old' })],
        ['MANAGE@SYSCONFIG@PAGE', '{"CONFIG":[{"ID":"defaultUploadChannel","VALUE":"telegram"}]}'],
        ['some-file-ID', 'file contents'],
    ]);
    const db = getDatabase({ KV: kv });

    assert.deepEqual(
        JSON.parse(await db.get('manage@sysConfig@site')),
        { siteName: 'Old', adminPath: '/old' }
    );
    assert.equal(kv.values.has('manage@sysConfig@site'), false);
    assert.equal(kv.values.has('MANAGE@SYSCONFIG@SITE'), false);
    assert.equal(kv.values.has('MANAGE@SYSCONFIG@PAGE'), false);
    assert.deepEqual(JSON.parse(kv.values.get('CONFIG')), {
        ...DEFAULT_STORED_CONFIG,
        SITE: { NAME: 'Old', ADMIN_PATH: 'old' },
    });
    assert.equal(await db.get('some-file-ID'), 'file contents');
});

test('migrates legacy client setting ID/VALUE entries to direct PAGE fields', async () => {
    const kv = createKV([['CONFIG', encodeSystemConfigValue({
        page: {
            convertToWebp: true,
            config: [
                { id: 'defaultConvertToWebp', value: false },
                { id: 'defaultCustomerCompress', value: false },
                { id: 'defaultCompressBar', value: 8 },
                { id: 'defaultCompressQuality', value: 3 },
                { id: 'defaultUploadChannel', value: 'cfr2' },
            ],
        },
    })]]);
    const db = getDatabase({ KV: kv });

    assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@page')), {
        convertToWebp: true,
        customerCompress: false,
        compressBar: 8,
        compressQuality: 3,
        channelId: '',
    });
    assert.deepEqual(JSON.parse(kv.values.get('CONFIG')).UPLOAD, {
        SELECT_CHANNEL: '',
        CONVERT_TO_WEBP: true,
        COMPRESS: false,
        COMPRESS_BAR: 8,
        COMPRESS_QUALITY: 3,
    });
});

test('migrates legacy three-letter channel IDs and selected-channel references', async () => {
    const kv = createKV([['CONFIG', JSON.stringify({
        SITE: { SITE_NAME: 'cf-imghub', ADMIN_PATH: '/admin' },
        SECURITY: { AUTH: { ADMIN: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'hash' } } },
        PAGE: { CHANNEL_ID: 'ABC', CONVERT_TO_WEBP: false },
        UPLOAD: {
            CFR2: {
                CHANNELS: [{ ID: 'ABC', TYPE: 'R2', NAME: 'Primary', ENABLED: true }],
            },
        },
    })]]);
    const db = getDatabase({ KV: kv });
    const page = JSON.parse(await db.get('manage@sysConfig@page'));
    const upload = JSON.parse(await db.get('manage@sysConfig@upload'));
    const stored = JSON.parse(kv.values.get('CONFIG'));

    assert.match(upload.cfr2.channels[0].id, /^[A-Z]{5}$/);
    assert.equal(page.channelId, upload.cfr2.channels[0].id);
    assert.equal(stored.CHANNELS[0].ID, page.channelId);
    assert.deepEqual(stored.ADMIN, { USERNAME: 'admin', PASSWORD: 'hash' });
    assert.deepEqual(stored.SITE, { NAME: 'cf-imghub', ADMIN_PATH: 'admin' });
});

test('updates and deletes one CONFIG section without changing the others', async () => {
    const kv = createKV();
    const db = getDatabase({ KV: kv });
    await db.put('manage@sysConfig@site', JSON.stringify({ siteName: 'Example', adminPath: '/panel' }));
    await db.put('manage@sysConfig@page', JSON.stringify({ config: [{ id: 'defaultUploadChannel', value: 'cfr2' }] }));
    await db.delete('manage@sysConfig@page');

    assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@site')), {
        siteName: 'Example',
        adminPath: '/panel',
    });
    assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@page')), {
        channelId: '',
        convertToWebp: false,
        customerCompress: true,
        compressBar: 5,
        compressQuality: 4,
    });
    assert.deepEqual(JSON.parse(kv.values.get('CONFIG')), {
        ...DEFAULT_STORED_CONFIG,
        SITE: { NAME: 'Example', ADMIN_PATH: 'panel' },
    });
});

test('migrates legacy D1 config and keeps the API casing on reads', async () => {
    const rows = new Map([
        ['manage@sysConfig@site', JSON.stringify({ siteName: 'Old', adminPath: '/old' })],
    ]);
    const db = new D1Database(createD1Binding(rows));

    assert.deepEqual(
        JSON.parse(await db.get('manage@sysConfig@site')),
        { siteName: 'Old', adminPath: '/old' }
    );
    assert.equal(rows.has('manage@sysConfig@site'), false);
    assert.equal(rows.has('MANAGE@SYSCONFIG@SITE'), false);
    assert.deepEqual(JSON.parse(rows.get('CONFIG')), {
        ...DEFAULT_STORED_CONFIG,
        SITE: { NAME: 'Old', ADMIN_PATH: 'old' },
    });
});

test('page settings persist only allowed values and preserve false values on reads', async () => {
    const kv = createKV([['CONFIG', encodeSystemConfigValue({
        upload: {
            cfr2: {
                channels: [{
                    id: 'ABCDE',
                    type: 'R2',
                    name: 'Example',
                    enabled: true,
                }],
            },
        },
    })]]);
    const env = { KV: kv };
    const channelId = JSON.parse(kv.values.get('CONFIG')).CHANNELS[0].ID;
    const response = await pageConfigHandler({
        request: new Request('https://example.test/api/manage/sysConfig/page', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: [
                    { id: 'defaultConvertToWebp', value: false, label: 'static text' },
                    { id: 'defaultChannelId', value: channelId, category: 'static metadata' },
                    { id: 'unknownSetting', value: 'must not persist' },
                ],
            }),
        }),
        env,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(await getDatabase(env).get('manage@sysConfig@page')), {
        channelId,
        convertToWebp: false,
        customerCompress: true,
        compressBar: 5,
        compressQuality: 4,
    });
    assert.equal(kv.values.has('MANAGE@SYSCONFIG@PAGE'), false);
    assert.equal(kv.values.has('manage@sysConfig@page'), false);

    const getResponse = await pageConfigHandler({
        request: new Request('https://example.test/api/manage/sysConfig/page'),
        env,
    });
    const settings = await getResponse.json();
    const webpSetting = settings.config.find(({ id }) => id === 'defaultConvertToWebp');
    const channelSetting = settings.config.find(({ id }) => id === 'defaultChannelId');

    assert.equal(webpSetting.value, false);
    assert.equal(webpSetting.label, '是否转换 WebP');
    assert.equal(webpSetting.label_en, 'Convert to WebP');
    assert.equal(webpSetting.category, '客户端设置');
    assert.equal(webpSetting.category_en, 'Client Settings');
    assert.deepEqual(channelSetting.options, [{
        value: channelId,
        label: 'R2 — Example',
        label_en: 'R2 — Example',
    }]);
});

test('page settings reject invalid values without writing CONFIG', async () => {
    const kv = createKV();
    const response = await pageConfigHandler({
        request: new Request('https://example.test/api/manage/sysConfig/page', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: [{ id: 'defaultChannelId', value: 'invalid' }],
            }),
        }),
        env: { KV: kv },
    });

    assert.equal(response.status, 400);
    assert.equal(kv.values.has('CONFIG'), false);
});

test('page settings preserve false values from USER_CONFIG', async () => {
    const response = await pageConfigHandler({
        request: new Request('https://example.test/api/manage/sysConfig/page'),
        env: {
            KV: createKV(),
            USER_CONFIG: JSON.stringify({ defaultConvertToWebp: false }),
        },
    });
    const settings = await response.json();

    assert.equal(
        settings.config.find(({ id }) => id === 'defaultConvertToWebp').value,
        false
    );
});

test('migrates the legacy default type and name to one channel ID', async () => {
    const kv = createKV([['CONFIG', encodeSystemConfigValue({
        page: {
            config: [
                { id: 'defaultUploadChannel', value: 'cfr2' },
                { id: 'defaultChannelName', value: 'archive' },
            ],
        },
        upload: {
            cfr2: {
                channels: [{
                    id: 'ABCDE',
                    type: 'R2',
                    name: 'archive',
                    enabled: true,
                    savePath: 'database',
                }],
            },
        },
    })]]);
    const response = await pageConfigHandler({
        request: new Request('https://example.test/api/manage/sysConfig/page'),
        env: { KV: kv },
    });
    const settings = await response.json();

    const channelId = JSON.parse(kv.values.get('CONFIG')).CHANNELS[0].ID;
    assert.equal(settings.config.find(({ id }) => id === 'defaultChannelId').value, channelId);
    assert.deepEqual(settings.config.find(({ id }) => id === 'defaultChannelId').options, [{
        value: channelId,
        label: 'R2 — archive',
        label_en: 'R2 — archive',
    }]);
    assert.deepEqual(JSON.parse(await getDatabase({ KV: kv }).get('manage@sysConfig@page')), {
        channelId,
        convertToWebp: false,
        customerCompress: true,
        compressBar: 5,
        compressQuality: 4,
    });
});
