import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, destroySession, rotateSessionSigningKey, validateSession } from '../functions/utils/auth/sessionManager.js';
import { encodeSystemConfigValue } from '../functions/utils/sysConfigStorage.js';

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
        async list({ prefix = '', cursor, limit = 100 } = {}) {
            const names = [...values.keys()]
                .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor))
                .sort();
            const keys = names.slice(0, limit).map((name) => ({ name }));
            return {
                keys,
                cursor: names.length > limit ? keys.at(-1)?.name : undefined,
                list_complete: names.length <= limit,
            };
        },
    };
}

function configEntry() {
    return ['CONFIG', encodeSystemConfigValue(JSON.stringify({
        security: {
            auth: { admin: { adminUsername: 'admin', adminPassword: '$pbkdf2$hash' } },
            access: { adminSessionMaxAge: 1, sessionSecure: false },
        },
    }))];
}

function requestWithCookie(cookie) {
    return new Request('https://example.test/', { headers: { Cookie: cookie } });
}

function tokenFromCookie(cookie) {
    return cookie.split(';', 1)[0].split('=', 2)[1];
}

test('stores signed sessions in CONFIG and does not write session KV records', async () => {
    const kv = createKV([
        configEntry(),
        ['manage@session@old-token', JSON.stringify({ authType: 'admin' })],
    ]);
    const env = { KV: kv };

    assert.equal((await validateSession(
        env,
        requestWithCookie('admin_session=legacy-token'),
        'admin'
    )).valid, false);
    assert.equal(kv.values.has('manage@session@old-token'), false);

    const session = await createSession(env, 'admin', 'admin');
    const token = tokenFromCookie(session.cookie);
    const result = await validateSession(env, requestWithCookie(`admin_session=${token}`), 'admin');
    const storedConfig = JSON.parse(kv.values.get('CONFIG'));

    assert.equal(result.valid, true);
    assert.equal(result.session.username, 'admin');
    assert.equal([...kv.values.keys()].some((key) => key.startsWith('manage@session@')), false);
    assert.match(storedConfig.SECURITY.SESSION_SIGNING_KEYS.ADMIN, /^[a-f0-9]{64}$/);
});

test('rejects tampered cookies and cookies issued for a different auth type', async () => {
    const kv = createKV([configEntry()]);
    const env = { KV: kv };
    const session = await createSession(env, 'admin', 'admin');
    const token = tokenFromCookie(session.cookie);
    const [payload, signature] = token.split('.');

    assert.equal((await validateSession(env, requestWithCookie(`admin_session=${payload}.${signature}x`), 'admin')).valid, false);
    assert.equal((await validateSession(env, requestWithCookie(`user_session=${token}`), 'user')).valid, false);
});

test('rotating the CONFIG signing key invalidates prior sessions and removes legacy session keys', async () => {
    const kv = createKV([
        configEntry(),
        ['manage@session@legacy-token', JSON.stringify({ authType: 'admin' })],
    ]);
    const env = { KV: kv };
    const session = await createSession(env, 'admin', 'admin');
    const token = tokenFromCookie(session.cookie);
    await rotateSessionSigningKey(env, 'admin');

    assert.equal((await validateSession(env, requestWithCookie(`admin_session=${token}`), 'admin')).valid, false);
    assert.equal(kv.values.has('manage@session@legacy-token'), false);
});

test('logout clears the cookie without creating a persistent session record', async () => {
    const kv = createKV([configEntry()]);
    const cookie = await destroySession({ KV: kv }, requestWithCookie('admin_session=token'), 'admin');

    assert.match(cookie, /^admin_session=;.*Max-Age=0/);
    assert.equal([...kv.values.keys()].some((key) => key.startsWith('manage@session@')), false);
});
