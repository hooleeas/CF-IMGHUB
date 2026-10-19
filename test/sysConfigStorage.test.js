import assert from 'node:assert/strict';
import test from 'node:test';
import { D1Database } from '../functions/utils/d1Database.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
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

test('stores all supported system config categories under uppercase KV keys', async () => {
    const kv = createKV();
    const db = getDatabase({ KV: kv });
    const categories = ['site', 'upload', 'security', 'page', 'others'];

    for (const category of categories) {
        await db.put(`manage@sysConfig@${category}`, JSON.stringify({ enabled: true }));
        assert.equal(
            kv.values.get(`MANAGE@SYSCONFIG@${category.toUpperCase()}`),
            '{"ENABLED":true}'
        );
        assert.equal(kv.values.has(`manage@sysConfig@${category}`), false);
        assert.deepEqual(
            JSON.parse(await db.get(`manage@sysConfig@${category}`)),
            { enabled: true }
        );
    }
});

test('migrates a legacy KV config on read and leaves unrelated keys untouched', async () => {
    const kv = createKV([
        ['manage@sysConfig@site', JSON.stringify({ siteName: 'Old', adminPath: '/old' })],
        ['some-file-ID', 'file contents'],
    ]);
    const db = getDatabase({ KV: kv });

    assert.deepEqual(
        JSON.parse(await db.get('manage@sysConfig@site')),
        { siteName: 'Old', adminPath: '/old' }
    );
    assert.equal(kv.values.has('manage@sysConfig@site'), false);
    assert.deepEqual(
        JSON.parse(kv.values.get('MANAGE@SYSCONFIG@SITE')),
        { SITE_NAME: 'Old', ADMIN_PATH: '/old' }
    );
    assert.equal(await db.get('some-file-ID'), 'file contents');
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
    assert.deepEqual(
        JSON.parse(rows.get('MANAGE@SYSCONFIG@SITE')),
        { SITE_NAME: 'Old', ADMIN_PATH: '/old' }
    );
});
