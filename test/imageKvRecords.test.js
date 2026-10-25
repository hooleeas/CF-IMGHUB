import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseAdapter } from '../functions/utils/databaseAdapter.js';
import { encodeSystemConfigValue } from '../functions/utils/sysConfigStorage.js';

function createKV(entries = []) {
  const values = new Map(entries);
  const metadata = new Map();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async getWithMetadata(key) {
      return values.has(key)
        ? { value: values.get(key), metadata: metadata.get(key) || {} }
        : null;
    },
    async put(key, value, options = {}) {
      values.set(key, value);
      if (options.metadata) metadata.set(key, options.metadata);
      else metadata.delete(key);
    },
    async delete(key) {
      values.delete(key);
      metadata.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...values.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name, metadata: metadata.get(name) }));
      return { keys, cursor: null, list_complete: true };
    },
    values,
    metadata,
  };
}

test('stores minimal image metadata under an IMG key with a twenty-character ID', async () => {
  const configValue = encodeSystemConfigValue({
    site: {},
    upload: {
      cfr2: { channels: [{ id: 'R2ABC', name: 'R2' }] },
    },
  });
  const kv = createKV([['CONFIG', configValue]]);
  const channelId = JSON.parse(configValue).CHANNELS[0].ID;
  const db = createDatabaseAdapter({ KV: kv });
  const metadata = {
    FileName: 'photo.webp',
    FileType: 'image/webp',
    FileSize: '0.00',
    FileSizeBytes: 4118,
    Channel: 'CloudflareR2',
    ChannelId: channelId,
    ChannelName: 'R2',
    UploadIP: '192.0.2.1',
    Width: 366,
    Height: 486,
  };

  await db.put('photo.webp', '', { metadata });

  const imageKey = [...kv.values.keys()].find((key) => key.startsWith('IMG_'));
  assert.match(imageKey, /^IMG_[A-Z0-9]{20}$/);
  const record = JSON.parse(kv.values.get(imageKey));
  assert.equal(kv.values.has('photo.webp'), false);
  assert.equal(record.FILE_NAME, 'photo.webp');
  assert.equal(record.FILE_TYPE, undefined);
  assert.equal(record.FILE_SIZE, 4118);
  assert.equal(record.TIME_STAMP, undefined);
  assert.equal(record.CHANNEL, channelId);
  assert.equal(Object.hasOwn(record, 'URL'), false);
  assert.equal(Object.hasOwn(record, 'CHANNEL_TYPE'), false);
  assert.equal(Object.hasOwn(record, 'CHANNEL_NAME'), false);
  assert.equal(Object.hasOwn(record, 'UPLOAD_IP'), false);
  assert.equal(record.WIDTH, 366);

  assert.deepEqual(await db.getWithMetadata('photo.webp'), {
    value: '',
    metadata: {
      FileName: 'photo.webp',
      FileType: 'image/webp',
      FileSize: '0.00',
      FileSizeBytes: 4118,
      Channel: 'CloudflareR2',
      ChannelId: channelId,
      ChannelName: 'R2',
      Width: 366,
      Height: 486,
    },
  });
  assert.equal(await db.get('photo.webp'), '');

  const listed = await db.list();
  const listedImage = listed.keys.find(({ name }) => name === 'photo.webp');
  assert.equal(listedImage.metadata.FileType, 'image/webp');

  await db.delete('photo.webp');
  assert.equal(kv.values.has(imageKey), false);
});

test('migrates an existing image KV metadata record to a twenty-character IMG ID on first read', async () => {
  const kv = createKV([['legacy.webp', '']]);
  kv.metadata.set('legacy.webp', {
    FileName: 'legacy.webp',
    FileType: 'image/webp',
    FileSizeBytes: 2000,
  });
  const db = createDatabaseAdapter({ KV: kv });

  const record = await db.getWithMetadata('legacy.webp');

  assert.equal(record.metadata.FileName, 'legacy.webp');
  assert.equal(kv.values.has('legacy.webp'), false);
  const imageKey = [...kv.values.keys()].find((key) => key.startsWith('IMG_'));
  assert.match(imageKey, /^IMG_[A-Z0-9]{20}$/);
  assert.equal(JSON.parse(kv.values.get(imageKey)).FILE_SIZE, 2000);
});

test('migrates prior IMG records and removes upload-only metadata', async () => {
  const configValue = encodeSystemConfigValue({
    site: {},
    upload: {
      cfr2: { channels: [{ name: 'R2' }] },
    },
  });
  const channelId = JSON.parse(configValue).CHANNELS[0].ID;
  const kv = createKV([
    ['CONFIG', configValue],
    ['IMG_1234567890', JSON.stringify({
      FILE_NAME: 'legacy.webp',
      FILE_TYPE: 'image/webp',
      FILE_SIZE: 4096,
      CHANNEL: channelId,
      CHANNEL_TYPE: 'CloudflareR2',
      CHANNEL_NAME: 'R2',
      URL: '/file/legacy.webp',
      UPLOAD_IP: '192.0.2.2',
      DIRECTORY: 'old/path/',
      WIDTH: 400,
      HEIGHT: 300,
      TIME_STAMP: 123,
    })],
  ]);
  const db = createDatabaseAdapter({ KV: kv });

  const result = await db.migrateLegacyImages();

  assert.deepEqual(
    { migrated: result.migrated, failed: result.failed },
    { migrated: 1, failed: 0 }
  );
  assert.equal(kv.values.has('IMG_1234567890'), false);
  const key = [...kv.values.keys()].find((name) => /^IMG_[A-Z0-9]{20}$/.test(name));
  const record = JSON.parse(kv.values.get(key));
  assert.deepEqual(record, {
    WIDTH: 400,
    HEIGHT: 300,
    FILE_NAME: 'legacy.webp',
    FILE_SIZE: 4096,
    CHANNEL: channelId,
  });
  const image = await db.getWithMetadata('legacy.webp');
  assert.equal(image.metadata.Channel, 'CloudflareR2');
  assert.equal(image.metadata.FileName, 'legacy.webp');
  assert.equal(image.metadata.UploadIP, undefined);
});

test('stores only the external link in URL for external images', async () => {
  const kv = createKV();
  const db = createDatabaseAdapter({ KV: kv });
  await db.put('external.webp', '', {
    metadata: {
      FileName: 'external.webp',
      FileType: 'image/webp',
      FileSizeBytes: 8192,
      Channel: 'External',
      ChannelName: 'External',
      ExternalLink: 'https://images.example.test/photo.webp',
      UploadIP: '192.0.2.3',
    },
  });

  const key = [...kv.values.keys()].find((name) => /^IMG_[A-Z0-9]{20}$/.test(name));
  const record = JSON.parse(kv.values.get(key));
  assert.equal(record.CHANNEL, 'EXTERNAL');
  assert.equal(record.URL, 'https://images.example.test/photo.webp');
  assert.equal(record.UPLOAD_IP, undefined);
  assert.equal(record.CHANNEL_TYPE, undefined);
  assert.deepEqual((await db.getWithMetadata('external.webp')).metadata, {
    FileName: 'external.webp',
    FileType: 'image/webp',
    FileSizeBytes: 8192,
    ExternalLink: 'https://images.example.test/photo.webp',
    ChannelId: 'EXTERNAL',
    Channel: 'External',
    FileSize: '0.01',
  });
});
