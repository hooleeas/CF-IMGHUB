import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/manage/batch/kv.js';

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
        async list({ cursor, limit = 1000 } = {}) {
            const names = [...values.keys()].sort();
            const offset = cursor ? Number(cursor) : 0;
            const keys = names.slice(offset, offset + limit).map((name) => ({ name }));
            const nextOffset = offset + keys.length;
            return {
                keys,
                list_complete: nextOffset >= names.length,
                cursor: nextOffset >= names.length ? undefined : String(nextOffset),
            };
        },
    };
}

function context(kv, path, method = 'GET', body) {
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
        env: { KV: kv },
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
});
