import assert from 'node:assert/strict';
import test from 'node:test';
import { clearChunkedIndex, saveChunkedIndex } from '../functions/utils/indexManager.js';

function createKV(entries = []) {
  const values = new Map(entries);
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...values.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, cursor: null };
    },
    values,
  };
}

test('does not store a duplicate image index in KV', async () => {
  const kv = createKV([
    ['manage@index@meta', JSON.stringify({ chunkCount: 1 })],
    ['manage@index_0', JSON.stringify([{ id: 'old.jpg', metadata: {} }])],
  ]);
  const result = await saveChunkedIndex(
    { env: { KV: kv } },
    {
      files: [{ id: 'photo.webp', metadata: { FileName: 'photo.webp', FileSize: '1' } }],
      totalCount: 1,
      lastUpdated: 123,
      lastOperationId: null,
    },
  );

  assert.equal(result.success, true);
  assert.equal([...kv.values.keys()].some((key) => key.startsWith('manage@index')), false);
  assert.equal(kv.values.has('IMGS'), false);
});

test('clears old aggregate and chunked image index KV entries', async () => {
  const kv = createKV([
    ['IMGS', JSON.stringify({
      lastUpdated: 123,
      totalCount: 1,
      lastOperationId: null,
      totalSizeMB: 2,
      channelStats: {},
      IMG: [[{
        id: 'r2/bucket/photo.webp',
        objectId: 'r2/bucket/photo.webp',
        storageType: 'R2',
        channelName: 'primary',
        fileName: 'photo.webp',
        metadata: { Channel: 'R2', ChannelName: 'primary', FileName: 'photo.webp' },
      }]],
    })],
    ['manage@index@meta', JSON.stringify({ totalCount: 1, chunkCount: 1 })],
    ['manage@index_0', JSON.stringify([{ id: 'photo.webp', metadata: {} }])],
    ['manage@index@operation_123', JSON.stringify({ type: 'add' })],
  ]);

  const result = await clearChunkedIndex({ env: { KV: kv } });

  assert.equal(result, true);
  assert.equal(kv.values.has('IMGS'), false);
  assert.equal([...kv.values.keys()].some((key) => key.startsWith('manage@index')), false);
});

test('does not persist large image indexes', async () => {
  const kv = createKV();
  const result = await saveChunkedIndex(
    { env: { KV: kv } },
    {
      files: [{ id: 'large-record', metadata: { Description: 'x'.repeat(24 * 1024 * 1024) } }],
      totalCount: 1,
      lastUpdated: 123,
      lastOperationId: null,
    },
  );

  assert.equal(result.success, true);
  assert.deepEqual([...kv.values.keys()], []);
});
