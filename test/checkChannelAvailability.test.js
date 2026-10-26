import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkChannelAvailability,
  onRequest,
} from '../functions/api/manage/sysConfig/checkChannel.js';
import { encodeSystemConfigValue } from '../functions/utils/sysConfigStorage.js';

const availableResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

test('R2 availability check reads a unique key without writing', async () => {
  let checkedKey = '';
  const status = await checkChannelAvailability('cfr2', { enabled: true }, {
    R2: {
      async head(key) {
        checkedKey = key;
        return null;
      },
    },
  });

  assert.deepEqual(status, { available: true, reason: 'available' });
  assert.match(checkedKey, /^__channel_health_check__\/[0-9a-f-]+$/i);
});

test('availability is measured even when a channel is disabled', async () => {
  let requested = false;
  const status = await checkChannelAvailability('discord', {
    enabled: false,
    botToken: 'token',
    channelId: '123',
  }, {}, async () => {
    requested = true;
    return availableResponse();
  });

  assert.deepEqual(status, { available: true, reason: 'available' });
  assert.equal(requested, true);
});

test('Telegram availability validates the bot and configured chat', async () => {
  const requestedUrls = [];
  const status = await checkChannelAvailability('telegram', {
    enabled: true,
    botToken: '12345:abc_DEF-123',
    chatId: '-10012345',
  }, {}, async (url) => {
    requestedUrls.push(String(url));
    return availableResponse();
  });

  assert.deepEqual(status, { available: true, reason: 'available' });
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1], /getChat\?chat_id=-10012345$/);
});

test('Discord and HuggingFace availability checks send configured credentials', async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.Authorization });
    return availableResponse();
  };

  const discord = await checkChannelAvailability('discord', {
    enabled: true,
    botToken: 'discord-token',
    channelId: '123456',
  }, {}, fakeFetch);
  const huggingface = await checkChannelAvailability('huggingface', {
    enabled: true,
    token: 'hf-token',
    repo: 'owner/model',
  }, {}, fakeFetch);

  assert.deepEqual(discord, { available: true, reason: 'available' });
  assert.deepEqual(huggingface, { available: true, reason: 'available' });
  assert.deepEqual(requests, [
    { url: 'https://discord.com/api/v10/channels/123456', authorization: 'Bot discord-token' },
    { url: 'https://huggingface.co/api/models/owner/model', authorization: 'Bearer hf-token' },
  ]);
});

test('WebDAV availability uses a read-only PROPFIND and configured auth headers', async () => {
  let request;
  const status = await checkChannelAvailability('webdav', {
    enabled: true,
    baseUrl: 'https://dav.example.com/files',
    username: 'user',
    password: 'pass',
  }, {}, async (url, options) => {
    request = { url: String(url), options };
    return new Response('', { status: 207 });
  });

  assert.deepEqual(status, { available: true, reason: 'available' });
  assert.equal(request.url, 'https://dav.example.com/files/');
  assert.equal(request.options.method, 'PROPFIND');
  assert.equal(request.options.headers.get('Depth'), '0');
  assert.match(request.options.headers.get('Authorization'), /^Basic /);
});

test('availability checks reject incomplete or unsafe storage configuration', async () => {
  assert.deepEqual(
    await checkChannelAvailability('s3', { enabled: true, endpoint: 'https://s3.example.com' }, {}),
    { available: false, reason: 'missing_configuration' },
  );
  assert.deepEqual(
    await checkChannelAvailability('s3', {
      enabled: true,
      endpoint: 'https://127.0.0.1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucketName: 'bucket',
    }, {}),
    { available: false, reason: 'unsafe_endpoint' },
  );
  assert.deepEqual(
    await checkChannelAvailability('webdav', { enabled: true, baseUrl: 'http://dav.example.com' }, {}),
    { available: false, reason: 'unsafe_endpoint' },
  );
});

test('availability endpoint resolves the saved channel and returns no credentials', async () => {
  const values = new Map([['CONFIG', encodeSystemConfigValue({
    upload: {
      telegram: {
        channels: [{
          id: 'ABCDE',
          name: 'Primary',
          type: 'telegram',
          enabled: true,
          botToken: 'private-token',
          chatId: '',
        }],
      },
    },
  })]]);
  const KV = {
    async get(key) { return values.get(key) ?? null; },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
  };
  const response = await onRequest({
    request: new Request('https://example.test/api/manage/sysConfig/checkChannel', {
      method: 'POST',
      body: JSON.stringify({ type: 'telegram', id: 'ABCDE' }),
    }),
    env: { KV },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { available: false, reason: 'missing_configuration' });
  assert.equal('botToken' in body, false);
  assert.equal('chatId' in body, false);
});
