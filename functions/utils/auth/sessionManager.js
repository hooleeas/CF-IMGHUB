/**
 * 会话管理工具
 * 使用签名的 HttpOnly Cookie 传递会话，不在 KV/D1 中保存登录会话。
 */

import { getDatabase } from '../databaseAdapter.js';
import { fetchSecurityConfig } from '../sysConfig.js';
import { normalizeSessionMaxAgeDays, sessionMaxAgeDaysToTtl } from './sessionConfig.js';

const SESSION_PREFIX = 'manage@session@';

const COOKIE_NAMES = {
    admin: 'admin_session',
    user: 'user_session',
};

export async function createSession(env, authType, username = '') {
    const securityConfig = await fetchSecurityConfig(env, { throwOnError: true });
    const accessConfig = securityConfig.access || {};
    const secure = accessConfig.sessionSecure ?? false;
    const rawMaxAgeDays = authType === 'admin'
        ? (accessConfig.adminSessionMaxAge ?? 14)
        : (accessConfig.userSessionMaxAge ?? 14);
    const maxAgeDays = normalizeSessionMaxAgeDays(rawMaxAgeDays);
    const maxAge = sessionMaxAgeDaysToTtl(maxAgeDays);
    const signingKey = await getOrCreateSigningKey(env, authType);
    const now = Date.now();
    const payload = encodeBase64Url(JSON.stringify({
        authType,
        username,
        createdAt: now,
        expiresAt: now + maxAge * 1000,
    }));
    const token = `${payload}.${await signPayload(signingKey, payload)}`;
    const cookieName = COOKIE_NAMES[authType] || 'session';
    return {
        token,
        cookie: buildSessionCookie(cookieName, token, maxAge, secure),
    };
}

export async function validateSession(env, request, authType) {
    const signingKey = await getOrCreateSigningKey(env, authType);
    const cookieName = COOKIE_NAMES[authType] || 'session';
    const token = getCookieValue(request, cookieName);
    if (!token) return { valid: false };

    const separator = token.lastIndexOf('.');
    if (separator <= 0 || separator === token.length - 1) return { valid: false };
    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!await verifyPayload(signingKey, payload, signature)) {
        return { valid: false };
    }

    try {
        const session = JSON.parse(decodeBase64Url(payload));
        if (session.authType !== authType
            || typeof session.username !== 'string'
            || !Number.isFinite(session.createdAt)
            || !Number.isFinite(session.expiresAt)
            || session.createdAt > Date.now() + 60_000
            || Date.now() > session.expiresAt) {
            return { valid: false };
        }
        return { valid: true, session };
    } catch {
        return { valid: false };
    }
}

export async function validateAnySession(env, request) {
    const adminResult = await validateSession(env, request, 'admin');
    if (adminResult.valid) return adminResult;

    return await validateSession(env, request, 'user');
}

export async function destroySession(env, request, authType) {
    const securityConfig = await fetchSecurityConfig(env, { throwOnError: true });
    const secure = securityConfig.access?.sessionSecure ?? false;
    if (authType) {
        const cookieName = COOKIE_NAMES[authType] || 'session';
        return buildSessionCookie(cookieName, '', 0, secure);
    }

    return Object.entries(COOKIE_NAMES).map(([, cookieName]) =>
        buildSessionCookie(cookieName, '', 0, secure)
    );
}

export async function rotateSessionSigningKey(env, authType) {
    const db = getDatabase(env);
    const settings = await readSecuritySettings(db);
    const signingKeys = getSigningKeys(settings);
    await clearLegacySessions(db);
    signingKeys[authType] = generateSigningKey();
    settings.sessionSigningKeys = signingKeys;
    await db.put('manage@sysConfig@security', JSON.stringify(settings));
}

async function getOrCreateSigningKey(env, authType) {
    const db = getDatabase(env);
    const settings = await readSecuritySettings(db);
    const signingKeys = getSigningKeys(settings);
    const existingKey = signingKeys[authType];
    if (isSigningKey(existingKey)) return existingKey;
    if (!Object.values(signingKeys).some(isSigningKey)) {
        await clearLegacySessions(db);
    }
    signingKeys[authType] = generateSigningKey();
    settings.sessionSigningKeys = signingKeys;
    await db.put('manage@sysConfig@security', JSON.stringify(settings));
    return signingKeys[authType];
}

function getSigningKeys(settings) {
    const signingKeys = settings.sessionSigningKeys;
    return signingKeys && typeof signingKeys === 'object' && !Array.isArray(signingKeys)
        ? signingKeys
        : {};
}

function isSigningKey(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

async function readSecuritySettings(db) {
    const settingsString = await db.get('manage@sysConfig@security');
    if (!settingsString) return {};
    const settings = JSON.parse(settingsString);
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
}

function generateSigningKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function clearLegacySessions(db) {
    let cursor;
    do {
        const result = await db.list({
            prefix: SESSION_PREFIX,
            limit: 1000,
            ...(cursor ? { cursor } : {}),
        });
        for (const { name } of result.keys || []) {
            await db.delete(name);
        }
        cursor = result.list_complete === false ? result.cursor : null;
    } while (cursor);
}

async function signPayload(secret, payload) {
    const key = await importSigningKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return encodeBase64Url(new Uint8Array(signature));
}

async function verifyPayload(secret, payload, signature) {
    try {
        const key = await importSigningKey(secret);
        return await crypto.subtle.verify(
            'HMAC',
            key,
            decodeBase64UrlBytes(signature),
            new TextEncoder().encode(payload)
        );
    } catch {
        return false;
    }
}

async function importSigningKey(secret) {
    const bytes = new Uint8Array(secret.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
    return await crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function encodeBase64Url(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value) {
    return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function decodeBase64UrlBytes(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url value.');
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getCookieValue(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const regex = new RegExp('(^|;\\s*)' + name + '=([^;]+)');
    const match = cookieHeader.match(regex);
    return match ? match[2] : null;
}

function buildSessionCookie(name, token, maxAge, secure = false) {
    const parts = [
        `${name}=${token}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Strict`,
        `Max-Age=${maxAge}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}
