import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/manage/batch/kv.js';
import { encodeSystemConfigValue } from '../functions/utils/sysConfigStorage.js';

function createKV(entries = [], metadataEntries = []) {
    const values = new Map(entries);
    const metadata = new Map(metadataEntries);
    return {
        values,
        metadata,
        async get(key) {
            return values.get(key) ?? null;
        },
        async getWithMetadata(key) {
            const value = values.get(key);
            return value === undefined ? null : { value, metadata: metadata.get(key) ?? null };
        },
        async put(key, value, options = {}) {
            values.set(key, value);
            metadata.set(key, options.metadata ?? null);
        },
        async delete(key) {
            values.delete(key);
        },
        async list({ cursor, limit = 1000, prefix = '' } = {}) {
            const names = [...values.keys()].filter((name) => name.startsWith(prefix)).sort();
            const offset = cursor ? Number(cursor) : 0;
            const keys = names.slice(offset, offset + limit).map((name) => {
                const entryMetadata = metadata.get(name);
                return entryMetadata ? { name, metadata: entryMetadata } : { name };
            });
            const nextOffset = offset + keys.length;
            return {
                keys,
                list_complete: nextOffset >= names.length,
                cursor: nextOffset >= names.length ? undefined : String(nextOffset),
            };
        },
    };
}

function createD1(tables = {}, { corruptFileValue = false } = {}) {
    const data = {
        files: new Map(tables.files || []),
        settings: new Map(tables.settings || []),
        index_operations: new Map(tables.index_operations || []),
        index_metadata: new Map(tables.index_metadata || []),
        other_data: new Map(tables.other_data || []),
    };
    const binding = {
        data,
        prepare(sql) {
            const normalized = sql.replace(/\s+/g, ' ').trim();
            let bound = [];
            const resultFor = (query, values) => {
                if (query.startsWith('SELECT key FROM settings')) {
                    const key = [...data.settings.keys()].find((name) => name === 'CONFIG'
                        || name.startsWith('manage@sysConfig@')
                        || name.startsWith('MANAGE@SYSCONFIG@'));
                    return key ? { key } : null;
                }
                if (query.startsWith('SELECT id FROM files')) return data.files.has('CONFIG') ? { id: 'CONFIG' } : null;
                if (query.startsWith('SELECT value FROM settings')) {
                    const value = data.settings.get(values[0]);
                    return value === undefined ? null : { value };
                }
                if (query.startsWith('SELECT * FROM files WHERE id = ?')) return data.files.get(values[0]) || null;
                if (query.startsWith('SELECT value FROM other_data')) {
                    const value = data.other_data.get(values[0]);
                    return value === undefined ? null : { value };
                }
                return null;
            };
            const run = async () => {
                if (normalized.startsWith('INSERT OR REPLACE INTO settings')) {
                    data.settings.set(bound[0], bound[1]);
                } else if (normalized.startsWith('DELETE FROM settings WHERE')) {
                    data.settings.delete(bound[0]);
                } else if (normalized.startsWith('INSERT OR REPLACE INTO files')) {
                    data.files.set(bound[0], {
                        id: bound[0],
                        value: corruptFileValue ? `${bound[1]}-corrupted` : bound[1],
                        metadata: bound[2],
                    });
                } else if (normalized.startsWith('DELETE FROM files WHERE')) {
                    data.files.delete(bound[0]);
                } else if (/^DELETE FROM (files|settings|index_operations|index_metadata|other_data)$/.test(normalized)) {
                    data[normalized.slice('DELETE FROM '.length)].clear();
                }
                return { meta: { changes: 1 } };
            };
            const all = async () => {
                if (normalized.startsWith('PRAGMA table_info(files)')) return { results: [{ name: 'tags' }] };
                if (normalized.startsWith('SELECT id, value, metadata FROM files')) {
                    return { results: [...data.files.values()].map((row) => ({ ...row })) };
                }
                if (normalized.startsWith('SELECT key, value FROM settings')) {
                    return { results: [...data.settings].map(([key, value]) => ({ key, value })) };
                }
                if (normalized.startsWith('SELECT id, type, timestamp, data FROM index_operations')) {
                    return { results: [...data.index_operations.values()] };
                }
                if (normalized.startsWith('SELECT * FROM index_metadata')) {
                    return { results: [...data.index_metadata.values()] };
                }
                if (normalized.startsWith('SELECT key, value FROM other_data')) {
                    return { results: [...data.other_data].map(([key, value]) => ({ key, value })) };
                }
                return { results: [] };
            };
            return {
                bind(...values) { bound = values; return this; },
                first: () => resultFor(normalized, bound),
                run,
                all,
            };
        },
    };
    return binding;
}

function context(kv, path, method = 'GET', body, d1) {
    const headers = body === undefined
        ? {}
        : {
            Origin: 'https://example.test',
            'Content-Type': 'application/json',
        };
    return {
        request: new Request(`https://example.test${path}`, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env: { KV: kv, ...(d1 ? { D1: d1 } : {}) },
    };
}

test('lists KV entries in pages and formats JSON for display', async () => {
    const entries = Array.from({ length: 105 }, (_, index) => [
        `key-${String(index).padStart(3, '0')}`,
        JSON.stringify({ index }),
    ]);
    const kv = createKV(entries);

    const first = await onRequest(context(kv, '/api/manage/batch/kv'));
    const firstPage = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstPage.entries.length, 100);
    assert.ok(firstPage.cursor);
    assert.deepEqual(firstPage.entries[0], { name: 'key-000' });

    const second = await onRequest(context(
        kv,
        `/api/manage/batch/kv?cursor=${encodeURIComponent(firstPage.cursor)}`
    ));
    const secondPage = await second.json();
    assert.equal(secondPage.entries.length, 5);
    assert.equal(secondPage.cursor, null);

    const value = await onRequest(context(
        kv,
        '/api/manage/batch/kv?key=key-000'
    ));
    const valueResult = await value.json();
    assert.equal(value.status, 200);
    assert.equal(valueResult.entry.value, '{\n  "index": 0\n}');
    assert.deepEqual(valueResult.entry.raw, { index: 0 });
});

test('shows database migration as available only when KV and D1 are both bound', async () => {
    const kv = createKV([['manage@system@databaseProvider', 'KV']]);
    const request = new Request('https://example.test/api/manage/batch/kv?database=status');
    const kvOnly = await onRequest({ request, env: { KV: kv } });
    const kvOnlyStatus = await kvOnly.json();

    assert.equal(kvOnlyStatus.canSwitch, false);
    assert.deepEqual(kvOnlyStatus.available, { KV: true, D1: false });

    const bothBound = await onRequest({ request, env: { KV: kv, D1: { prepare() {} } } });
    const bothBoundStatus = await bothBound.json();

    assert.equal(bothBoundStatus.canSwitch, true);
    assert.deepEqual(bothBoundStatus.available, { KV: true, D1: true });
});

test('migrates KV records and image metadata to D1, verifies them, then clears KV', async () => {
    const imageMetadata = {
        FileName: 'photo.png',
        FileType: 'image/png',
        FileSizeBytes: 1234,
        Channel: 'External',
        ExternalLink: 'https://images.example.test/photo.png',
    };
    const additionalSettings = Array.from({ length: 125 }, (_, index) => [
        `manage@custom@setting-${String(index).padStart(3, '0')}`,
        JSON.stringify({ index }),
    ]);
    const kv = createKV(
        [
            ['manage@system@databaseProvider', 'KV'],
            ['manage@custom@preferences', JSON.stringify({ layout: 'grid' })],
            ...additionalSettings,
            ['photo.png', 'external-photo-value'],
        ],
        [['photo.png', imageMetadata]]
    );
    const d1 = createD1();

    const response = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'switch_database',
        target: 'D1',
    }, d1));
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.current, 'D1');
    assert.equal(result.verified, 127);
    assert.equal(result.sourceCleared, true);
    assert.equal(await kv.get('manage@system@databaseProvider'), null);
    assert.equal(await kv.get('photo.png'), null);
    assert.equal(d1.data.settings.get('manage@custom@preferences'), JSON.stringify({ layout: 'grid' }));
    assert.equal(d1.data.settings.get('manage@custom@setting-124'), JSON.stringify({ index: 124 }));
    assert.equal(d1.data.files.get('photo.png').value, 'external-photo-value');
    assert.deepEqual(JSON.parse(d1.data.files.get('photo.png').metadata), {
        ...imageMetadata,
        ChannelId: 'EXTERNAL',
        FileSize: '0.00',
    });
});

test('migrates D1 records and image metadata to KV, verifies them, then clears D1', async () => {
    const imageMetadata = {
        FileName: 'photo.png',
        FileType: 'image/png',
        FileSizeBytes: 1234,
        Channel: 'External',
        ChannelId: 'EXTERNAL',
        ExternalLink: 'https://images.example.test/photo.png',
    };
    const d1 = createD1({
        settings: [
            ['manage@system@databaseProvider', 'D1'],
            ['manage@custom@preferences', JSON.stringify({ layout: 'list' })],
        ],
        files: [['photo.png', { id: 'photo.png', value: 'external-photo-value', metadata: JSON.stringify(imageMetadata) }]],
    });
    const kv = createKV([['manage@system@databaseProvider', 'D1']]);

    const response = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'switch_database',
        target: 'KV',
    }, d1));
    const result = await response.json();

    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.current, 'KV');
    assert.equal(result.verified, 2);
    assert.equal(result.sourceCleared, true);
    assert.equal(await kv.get('manage@custom@preferences'), JSON.stringify({ layout: 'list' }));
    assert.equal(await kv.get('photo.png'), null);
    assert.equal(await kv.get('manage@system@databaseProvider'), 'KV');
    const imageRecord = [...kv.values.entries()].find(([key]) => key.startsWith('IMG_'));
    assert.ok(imageRecord);
    assert.equal(JSON.parse(imageRecord[1]).FILE_NAME, 'photo.png');
    assert.equal(JSON.parse(imageRecord[1]).URL, imageMetadata.ExternalLink);
    assert.equal(d1.data.files.size, 0);
    assert.equal(d1.data.settings.size, 0);
});

test('keeps the active KV database intact when migration verification fails', async () => {
    const kv = createKV(
        [['manage@system@databaseProvider', 'KV'], ['photo.png', 'source-image']],
        [['photo.png', {
            FileName: 'photo.png',
            FileType: 'image/png',
            FileSizeBytes: 1234,
            Channel: 'External',
        }]]
    );
    const d1 = createD1({}, { corruptFileValue: true });

    const response = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'switch_database',
        target: 'D1',
    }, d1));
    const result = await response.json();

    assert.equal(response.status, 409);
    assert.match(result.error, /核对未通过/);
    assert.equal(await kv.get('manage@system@databaseProvider'), 'KV');
    assert.ok([...kv.values.keys()].some((key) => key.startsWith('IMG_')));
});

test('lists each image KV record individually and hides the legacy IMGS index', async () => {
    const kv = createKV(
        [['photo.webp', ''], ['other-record', ''], ['IMGS', '{"IMG":[]}']],
        [['photo.webp', { FileName: 'photo.webp', FileType: 'image/webp', PrivateField: 'hidden' }]]
    );
    const response = await onRequest(context(kv, '/api/manage/batch/kv'));
    const result = await response.json();

    assert.deepEqual(result.entries, [
        { name: 'other-record' },
        { name: 'photo.webp' },
    ]);
});

test('lists IMG_filename records as ordinary KV entries', async () => {
    const kv = createKV([['IMG_photo.webp', JSON.stringify({
        FILE_NAME: 'photo.webp',
        FILE_TYPE: 'image/webp',
        FILE_SIZE: 4118,
        CHANNEL: 'R2ABC',
        URL: '/file/photo.webp',
    })]]);
    const response = await onRequest(context(kv, '/api/manage/batch/kv'));

    assert.deepEqual((await response.json()).entries, [{ name: 'IMG_photo.webp' }]);
});

test('migrates all legacy image KV records when explicitly confirmed', async () => {
    const config = encodeSystemConfigValue({
        site: {},
        upload: {
            cfr2: { channels: [{ name: 'R2' }] },
        },
    });
    const channelId = JSON.parse(config).CHANNELS[0].ID;
    const kv = createKV(
        [
            ['photo.webp', 'legacy-content'],
            ['setting', 'value'],
            ['manage@index@operation_123', '{"type":"add"}'],
        ],
        [['photo.webp', {
            FileName: 'photo.webp',
            FileType: 'image/webp',
            FileSizeBytes: 4118,
            Channel: 'CloudflareR2',
            ChannelName: 'R2',
            ChannelId: channelId,
        }]]
    );
    kv.values.set('CONFIG', config);
    const denied = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'migrate_legacy_storage',
        confirmation: 'no',
    }));
    assert.equal(denied.status, 400);

    const response = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'migrate_legacy_storage',
        confirmation: 'MIGRATE_LEGACY_IMAGES',
    }));
    const result = await response.json();

    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.images.scanned, 1);
    assert.equal(result.images.migrated, 1);
    assert.equal(result.images.failed, 0);
    assert.equal(kv.values.has('photo.webp'), false);
    const imageKey = [...kv.values.keys()].find((key) => /^IMG_[A-Z0-9]{20}$/.test(key));
    assert.equal(JSON.parse(kv.values.get(imageKey)).CHANNEL, channelId);
    assert.equal(kv.values.get('setting'), 'value');
    assert.equal(kv.values.has('manage@index@operation_123'), false);
});

test('imports JSON entries only for same-origin requests', async () => {
    const kv = createKV();
    const deniedRequest = new Request('https://example.test/api/manage/batch/kv', {
        method: 'POST',
        headers: {
            Origin: 'https://attacker.test',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'import_all_json', payload: { KEY: { OK: true } } }),
    });

    const denied = await onRequest({ request: deniedRequest, env: { KV: kv } });
    assert.equal(denied.status, 403);

    const imported = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'import_all_json',
        payload: { KEY: { OK: true }, RAW: 'plain value' },
    }));
    assert.equal(imported.status, 200);
    assert.equal((await imported.json()).count, 2);
    assert.equal(kv.values.get('KEY'), '{\n  "OK": true\n}');
    assert.equal(kv.values.get('RAW'), 'plain value');
});

test('rejects imports that would restore the obsolete IMGS index key', async () => {
    const kv = createKV();
    const request = new Request('https://example.test/api/manage/batch/kv', {
        method: 'POST',
        headers: {
            Origin: 'https://example.test',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'import_all_json',
            payload: { IMGS: { IMG: [] }, OTHER: { retained: true } },
        }),
    });

    const response = await onRequest({ request, env: { KV: kv } });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.error, /IMGS/);
    assert.equal(kv.values.size, 0);
});

test('requires an explicit confirmation before factory reset', async () => {
    const kv = createKV([['one', '1'], ['two', '2']]);
    const denied = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'factory_reset',
        confirmation: 'no',
    }));
    assert.equal(denied.status, 400);
    assert.equal(kv.values.size, 2);

    const reset = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'factory_reset',
        confirmation: 'DELETE',
    }));
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).deleted, 2);
    assert.equal(kv.values.size, 0);
});

test('cleans default file metadata while preserving meaningful values', async () => {
    const oldIndexMeta = {
        lastUpdated: 1,
        chunkSize: 5000,
    };
    const fileMetadata = {
        FileName: 'photo.jpg',
        UploadAddress: '未知',
        ListType: 'None',
        Label: 'None',
        Directory: '',
        Tags: [],
    };
    const meaningfulMetadata = {
        FileName: 'blocked.jpg',
        UploadAddress: 'New York',
        ListType: 'Block',
        Label: 'adult',
        Directory: 'private/',
        Tags: ['reviewed'],
    };
    const kv = createKV([
        ['manage@index@meta', JSON.stringify(oldIndexMeta)],
        ['manage@index_0', JSON.stringify([
            { id: 'photo.jpg', metadata: fileMetadata },
            { id: 'blocked.jpg', metadata: meaningfulMetadata },
        ])],
        ['IMG_default.webp', JSON.stringify({
            FILE_NAME: 'default.webp',
            UPLOAD_ADDRESS: '未知',
            LIST_TYPE: 'None',
            LABEL: 'None',
            DIRECTORY: '',
            TAGS: [],
        })],
        ['IMG_meaningful.webp', JSON.stringify({
            FILE_NAME: 'meaningful.webp',
            UPLOAD_ADDRESS: 'New York',
            LIST_TYPE: 'Block',
            LABEL: 'adult',
            DIRECTORY: 'private/',
            TAGS: ['reviewed'],
        })],
        ['photo.jpg', ''],
        ['blocked.jpg', ''],
    ], [
        ['photo.jpg', fileMetadata],
        ['blocked.jpg', meaningfulMetadata],
    ]);

    const denied = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'clean_default_metadata',
        confirmation: 'no',
    }));
    assert.equal(denied.status, 400);

    const response = await onRequest(context(kv, '/api/manage/batch/kv', 'POST', {
        type: 'clean_default_metadata',
        confirmation: 'CLEAN_METADATA_DEFAULTS',
    }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.deepEqual(kv.metadata.get('photo.jpg'), { FileName: 'photo.jpg' });
    assert.deepEqual(kv.metadata.get('blocked.jpg'), meaningfulMetadata);
    assert.deepEqual(JSON.parse(kv.values.get('manage@index_0'))[0].metadata, { FileName: 'photo.jpg' });
    assert.deepEqual(JSON.parse(kv.values.get('manage@index_0'))[1].metadata, meaningfulMetadata);
    assert.deepEqual(JSON.parse(kv.values.get('manage@index@meta')), { lastUpdated: 1 });
    assert.deepEqual(JSON.parse(kv.values.get('IMG_default.webp')), { FILE_NAME: 'default.webp' });
    assert.deepEqual(JSON.parse(kv.values.get('IMG_meaningful.webp')), {
        FILE_NAME: 'meaningful.webp',
        UPLOAD_ADDRESS: 'New York',
        LIST_TYPE: 'Block',
        LABEL: 'adult',
        DIRECTORY: 'private/',
        TAGS: ['reviewed'],
    });
});
