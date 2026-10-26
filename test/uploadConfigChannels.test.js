import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/manage/sysConfig/upload.js';
import {
  decodeSystemConfigValue,
  encodeSystemConfigValue,
} from '../functions/utils/sysConfigStorage.js';

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
    values,
  };
}

function requestContext(kv, method, body, envOverrides = { R2: {} }) {
  return {
    request: new Request('https://example.test/api/manage/sysConfig/upload', {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env: { KV: kv, ...envOverrides },
  };
}

function readConfig(kv) {
  return JSON.parse(decodeSystemConfigValue(kv.values.get('CONFIG')));
}

const DEFAULTS = {
  site: { adminPath: '/admin', siteName: 'cf-imghub' },
  security: { auth: { admin: { adminUsername: '', adminPassword: '' } } },
  others: {
    cloudflareApiToken: { CF_ZONE_ID: '', CF_EMAIL: '', CF_API_KEY: '' },
    webDAV: {
      enabled: false,
      username: '',
      password: '',
      uploadChannel: '',
      channelName: '',
      internalToken: '',
      internalTokenId: '',
    },
  },
  page: {
    channelId: '',
    convertToWebp: false,
    customerCompress: true,
    compressBar: 5,
    compressQuality: 4,
  },
};

test('persists a manually added R2 channel without persisting environment channels', async () => {
  const kv = createKV();
  const settings = {
    cfr2: {
      channels: [
        { id: 1, name: 'R2', fixed: true, savePath: 'environment variable' },
        { id: 2, name: 'archive', fixed: false, savePath: 'database', quota: 12 },
      ],
      loadBalance: { enabled: false, channels: [] },
    },
    telegram: {
      channels: [
        { id: 1, name: 'Telegram_env', savePath: 'environment variable' },
        { id: 2, name: 'backup', savePath: 'database' },
      ],
    },
  };

  const response = await onRequest(requestContext(kv, 'POST', settings, {
    R2: { put() {}, head() {} },
  }));
  const result = await response.json();
  const config = readConfig(kv);

  assert.equal(response.status, 200);
  assert.equal(result.cfr2.channels.length, 1);
  assert.equal(result.cfr2.channels[0].name, 'archive');
  assert.deepEqual(config.upload.cfr2.channels, [{
    id: result.cfr2.channels[0].id,
    name: 'archive',
    enabled: true,
    type: 'cfr2',
  }]);
  assert.deepEqual(config.upload.telegram.channels.map((channel) => channel.name).filter(Boolean), ['backup']);
  assert.deepEqual(config.upload.telegram.channels.find((channel) => channel.savePath), {
    enabled: true,
    savePath: 'environment variable',
  });
  assert.match(config.upload.telegram.channels.find((channel) => channel.name)?.id, /^[A-Z]{5}$/);
  assert.equal(JSON.stringify(config.upload.telegram.channels).includes('Telegram_env'), false);
  assert.equal(config.upload.cfr2.loadBalance, undefined);
});

test('persists only editable, non-secret environment channel overrides', async () => {
  const kv = createKV();
  const env = { R2: {}, TG_BOT_TOKEN: 'environment-secret', TG_CHAT_ID: 'chat-1' };
  const response = await onRequest(requestContext(kv, 'POST', {
    telegram: {
      channels: [{
        id: 'TGAAA',
        name: 'Telegram_env',
        type: 'telegram',
        fixed: true,
        savePath: 'environment variable',
        enabled: false,
        botToken: 'environment-secret',
        chatId: 'chat-1',
        proxyUrl: 'https://proxy.example.com',
      }],
    },
  }, env));
  const saved = readConfig(kv).upload.telegram.channels;

  assert.equal(response.status, 200);
  assert.deepEqual(saved, [{
    savePath: 'environment variable',
    enabled: false,
    proxyUrl: 'https://proxy.example.com',
  }]);

  const getResponse = await onRequest(requestContext(kv, 'GET', undefined, env));
  const result = await getResponse.json();
  assert.equal(result.telegram.channels[0].enabled, false);
  assert.equal(result.telegram.channels[0].proxyUrl, 'https://proxy.example.com');
  assert.equal(result.telegram.channels[0].botToken, 'environment-secret');
});

test('removes legacy automatic R2 records and preserves a manual channel', async () => {
  const kv = createKV([['CONFIG', encodeSystemConfigValue({
    upload: {
      cfr2: {
        channels: [
          { id: 1, name: 'R2', fixed: true, savePath: 'environment variable' },
          { id: 2, name: 'archive', savePath: 'database' },
        ],
      },
    },
  })]]);

  const response = await onRequest(requestContext(kv, 'GET'));
  const result = await response.json();
  const config = readConfig(kv);

  assert.equal(response.status, 200);
  assert.deepEqual(config.upload.cfr2.channels, [
    { id: result.cfr2.channels[0].id, name: 'archive', enabled: true, type: 'cfr2' },
  ]);
  assert.deepEqual(result.cfr2.channels.map(({ name }) => name), ['archive']);
});

test('starts without R2 channels even when an R2 bucket is bound', async () => {
  const kv = createKV();
  const response = await onRequest(requestContext(kv, 'GET', undefined, {
    R2: { put() {}, head() {} },
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.cfr2.channels, []);
  assert.equal(result.capabilities.cfr2, true);
  assert.equal(readConfig(kv).upload?.cfr2, undefined);
});

test('reports that R2 cannot be added when the bucket binding is missing', async () => {
  const kv = createKV();
  const response = await onRequest(requestContext(kv, 'GET'));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.capabilities.cfr2, false);
});

test('saves and returns an editable name for a manually added R2 channel', async () => {
  const kv = createKV();
  const r2Env = { R2: { put() {}, head() {} } };
  const response = await onRequest(requestContext(kv, 'POST', {
    cfr2: {
      channels: [{
        id: 'ONEAA',
        type: 'cfr2',
        name: 'PrimaryBucket',
        enabled: true,
      }],
    },
  }, r2Env));
  const result = await response.json();
  const editResponse = await onRequest(requestContext(kv, 'POST', {
    cfr2: {
      channels: [{
        ...result.cfr2.channels[0],
        name: 'ArchiveBucket',
      }],
    },
  }, r2Env));
  const editResult = await editResponse.json();

  assert.equal(response.status, 200);
  assert.equal(result.cfr2.channels[0].name, 'PrimaryBucket');
  assert.equal(editResponse.status, 200);
  assert.equal(editResult.cfr2.channels[0].name, 'ArchiveBucket');
  assert.equal(readConfig(kv).upload.cfr2.channels[0].name, 'ArchiveBucket');
});

test('rejects duplicate channel names across upload channel types', async () => {
  const kv = createKV();
  const response = await onRequest(requestContext(kv, 'POST', {
    cfr2: {
      channels: [{ id: 'ONEAA', name: 'archive', enabled: true }],
    },
    s3: {
      channels: [{ id: 'TWOAA', name: 'archive', enabled: true }],
    },
  }));
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.error, '渠道名称不可重复。');
  assert.equal(kv.values.has('CONFIG'), false);
});

test('allows editing a channel without changing its unique name', async () => {
  const kv = createKV();
  const firstResponse = await onRequest(requestContext(kv, 'POST', {
    telegram: {
      channels: [{ id: 'ONEAA', name: 'archive', enabled: true }],
    },
  }));
  const saved = await firstResponse.json();
  const editResponse = await onRequest(requestContext(kv, 'POST', {
    telegram: {
      channels: [{ ...saved.telegram.channels[0], name: 'archive' }],
    },
  }));

  assert.equal(editResponse.status, 200);
  assert.equal((await editResponse.json()).telegram.channels[0].name, 'archive');
});

test('allows one manually added R2 channel when an R2 bucket is bound', async () => {
  const duplicateR2Channels = Array.from({ length: 20 }, (_, index) => ({
    id: `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}AA`,
    name: `Primary-${index}`,
    type: 'R2',
    enabled: true,
  }));
  const kv = createKV([['CONFIG', encodeSystemConfigValue({
    upload: {
      cfr2: {
        channels: [
          ...duplicateR2Channels,
          { id: 'ARCAA', name: 'archive', type: 'R2', enabled: true },
        ],
      },
    },
  })]]);

  const r2Env = { R2: { put() {}, head() {} } };
  const firstResponse = await onRequest(requestContext(kv, 'GET', undefined, r2Env));
  const firstResult = await firstResponse.json();
  assert.deepEqual(firstResult.cfr2.channels.map(({ name }) => name), ['Primary-0']);

  const saveResponse = await onRequest(requestContext(kv, 'POST', {
    cfr2: { channels: [...duplicateR2Channels, { id: 'ARCAA', name: 'archive', type: 'R2' }] },
  }, r2Env));
  assert.equal(saveResponse.status, 200);
  const firstStoredConfig = readConfig(kv);
  const secondResponse = await onRequest(requestContext(kv, 'GET', undefined, r2Env));
  const secondResult = await secondResponse.json();
  const secondStoredConfig = readConfig(kv);

  assert.deepEqual(secondResult.cfr2.channels.map(({ name }) => name), ['Primary-0']);
  assert.deepEqual(firstStoredConfig.upload.cfr2.channels, [
    { id: 'AAAAA', name: 'Primary-0', enabled: true, type: 'cfr2' },
  ]);
  assert.deepEqual(secondStoredConfig.upload.cfr2.channels, firstStoredConfig.upload.cfr2.channels);
});

test('rejects adding an R2 channel when no bucket binding exists', async () => {
  const kv = createKV();
  const response = await onRequest(requestContext(kv, 'POST', {
    cfr2: {
      channels: [
        { id: 'ONEAA', name: 'Primary', type: 'R2', enabled: true },
        { id: 'TWOAA', name: 'Secondary', type: 'R2', enabled: true },
      ],
    },
  }, { R2: null }));
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.error, '当前项目未绑定 Cloudflare R2 存储桶。');
  assert.equal(readConfig(kv).upload.cfr2, undefined);
});

test('stores WebDAV details in one enabled channel record with uppercase keys', async () => {
  const kv = createKV();
  const response = await onRequest(requestContext(kv, 'POST', {
    webdav: {
      channels: [{
        type: 'webdav',
        name: 'My DAV',
        baseUrl: 'https://example.test/dav',
        username: 'writer',
        password: 'secret',
        enabled: true,
        savePath: 'database',
      }],
    },
  }));
  const result = await response.json();
  const storedChannel = JSON.parse(kv.values.get('CONFIG')).CHANNELS[0];

  assert.equal(response.status, 200);
  assert.match(storedChannel.ID, /^[A-Z]{5}$/);
  assert.deepEqual(storedChannel, {
    ID: storedChannel.ID,
    CHANNEL: 'WebDAV',
    NAME: 'My DAV',
    URL: 'https://example.test/dav',
    USERNAME: 'writer',
    PASSWORD: 'secret',
    ENABLED: true,
  });
  assert.equal(result.webdav.channels[0].baseUrl, undefined);
  const getResponse = await onRequest(requestContext(kv, 'GET'));
  const loaded = await getResponse.json();
  assert.equal(loaded.webdav.channels[0].baseUrl, 'https://example.test/dav');
  assert.equal(loaded.webdav.channels[0].id, storedChannel.ID);
});

test('removes empty channel and default load-balance templates from CONFIG', async () => {
  const emptyChannelSettings = {
    channels: [],
    loadBalance: { enabled: false, channels: [] },
  };
  const kv = createKV([['CONFIG', encodeSystemConfigValue({
    site: { siteName: 'Existing site' },
    upload: Object.fromEntries([
      'telegram', 'cfr2', 's3', 'discord', 'huggingface', 'webdav',
    ].map((type) => [type, emptyChannelSettings])),
  })]]);
  const response = await onRequest(requestContext(kv, 'GET', undefined, { R2: null }));
  const result = await response.json();
  const config = readConfig(kv);

  assert.equal(response.status, 200);
  assert.deepEqual(config.site, { adminPath: '/admin', siteName: 'Existing site' });
  assert.deepEqual(config.security, DEFAULTS.security);
  assert.deepEqual(config.page, DEFAULTS.page);
  assert.deepEqual(config.upload, {});
  assert.ok(result.telegram.channels.length === 0);
  assert.deepEqual(result.telegram.loadBalance, { enabled: false, channels: [] });
});

test('deletes an empty upload category without deleting other CONFIG categories', async () => {
  const kv = createKV([['CONFIG', encodeSystemConfigValue({
    site: { siteName: 'Existing site' },
  })]]);
  const response = await onRequest(requestContext(kv, 'POST', {
    telegram: { channels: [], loadBalance: { enabled: false, channels: [] } },
    cfr2: { channels: [] },
    s3: { channels: [] },
    discord: { channels: [] },
    huggingface: { channels: [] },
    webdav: { channels: [] },
  }, { R2: null }));
  const result = await response.json();
  const config = readConfig(kv);

  assert.equal(response.status, 200);
  assert.deepEqual(result, {});
  assert.deepEqual(config, {
    ...DEFAULTS,
    site: { adminPath: '/admin', siteName: 'Existing site' },
    upload: {},
  });
});
