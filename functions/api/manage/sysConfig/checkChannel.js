import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { getUploadConfig } from './upload.js';
import { WebDAVAPI } from '../../../utils/storage/webdavAPI.js';

const CHANNEL_TYPES = new Set(['telegram', 'cfr2', 's3', 'discord', 'huggingface', 'webdav']);
const CHECK_TIMEOUT_MS = 8000;

function result(available, reason) {
    return { available, reason };
}

function isSafeRemoteUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return false;

    const hostname = url.hostname.toLowerCase();
    if (
        hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname.endsWith('.local')
        || hostname.endsWith('.internal')
        || hostname.endsWith('.lan')
        || hostname.endsWith('.test')
        || /^[0-9.]+$/.test(hostname)
        || hostname.includes(':')
    ) return false;
    return true;
}

async function withTimeout(run) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
        return await run(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
}

async function checkHttpResponse(url, options, fetcher) {
    try {
        const response = await withTimeout((signal) => fetcher(url, {
            ...options,
            redirect: 'manual',
            signal,
        }));
        return result(response.ok, response.ok ? 'available' : 'remote_rejected');
    } catch (error) {
        return result(false, error?.name === 'AbortError' ? 'timeout' : 'connection_failed');
    }
}

export async function checkChannelAvailability(type, channel, env, fetcher = fetch) {
    if (!channel) return result(false, 'missing_configuration');

    if (type === 'cfr2') {
        if (!env?.R2 || typeof env.R2.head !== 'function') return result(false, 'storage_not_configured');
        try {
            await withTimeout(() => env.R2.head(`__channel_health_check__/${crypto.randomUUID()}`));
            return result(true, 'available');
        } catch {
            return result(false, 'connection_failed');
        }
    }

    if (type === 'telegram') {
        if (!channel.botToken || !channel.chatId) return result(false, 'missing_configuration');
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(channel.botToken)) return result(false, 'invalid_configuration');
        let apiOrigin = 'https://api.telegram.org';
        if (channel.proxyUrl) {
            let proxyUrl;
            try {
                proxyUrl = new URL(`https://${channel.proxyUrl}`);
            } catch {
                return result(false, 'invalid_configuration');
            }
            if (
                proxyUrl.username
                || proxyUrl.password
                || proxyUrl.pathname !== '/'
                || proxyUrl.search
                || proxyUrl.hash
                || !isSafeRemoteUrl(proxyUrl.toString())
            ) return result(false, 'unsafe_endpoint');
            apiOrigin = proxyUrl.origin;
        }
        try {
            return await withTimeout(async (signal) => {
                const base = `${apiOrigin}/bot${channel.botToken}`;
                const botResponse = await fetcher(`${base}/getMe`, { signal });
                if (!botResponse.ok || (await botResponse.json()).ok !== true) {
                    return result(false, 'remote_rejected');
                }
                const chatResponse = await fetcher(`${base}/getChat?chat_id=${encodeURIComponent(channel.chatId)}`, { signal });
                const chatValid = chatResponse.ok && (await chatResponse.json()).ok === true;
                return result(chatValid, chatValid ? 'available' : 'remote_rejected');
            });
        } catch (error) {
            return result(false, error?.name === 'AbortError' ? 'timeout' : 'connection_failed');
        }
    }

    if (type === 'discord') {
        if (!channel.botToken || !channel.channelId) return result(false, 'missing_configuration');
        if (!/^\d{1,22}$/.test(String(channel.channelId))) return result(false, 'invalid_configuration');
        return checkHttpResponse(
            `https://discord.com/api/v10/channels/${encodeURIComponent(channel.channelId)}`,
            { method: 'GET', headers: { Authorization: `Bot ${channel.botToken}` } },
            fetcher,
        );
    }

    if (type === 'huggingface') {
        if (!channel.token || !channel.repo) return result(false, 'missing_configuration');
        const repoParts = String(channel.repo).split('/');
        if (repoParts.length !== 2 || repoParts.some((part) => !/^[\w.-]+$/.test(part))) {
            return result(false, 'invalid_configuration');
        }
        return checkHttpResponse(
            `https://huggingface.co/api/models/${repoParts.map(encodeURIComponent).join('/')}`,
            { method: 'GET', headers: { Authorization: `Bearer ${channel.token}` } },
            fetcher,
        );
    }

    if (type === 's3') {
        if (!channel.endpoint || !channel.accessKeyId || !channel.secretAccessKey || !channel.bucketName) {
            return result(false, 'missing_configuration');
        }
        if (!isSafeRemoteUrl(channel.endpoint)) return result(false, 'unsafe_endpoint');
        try {
            const client = new S3Client({
                region: channel.region || 'auto',
                endpoint: channel.endpoint,
                credentials: {
                    accessKeyId: channel.accessKeyId,
                    secretAccessKey: channel.secretAccessKey,
                },
                forcePathStyle: Boolean(channel.pathStyle),
                maxAttempts: 1,
            });
            await withTimeout((signal) => client.send(
                new HeadBucketCommand({ Bucket: channel.bucketName }),
                { abortSignal: signal },
            ));
            return result(true, 'available');
        } catch (error) {
            return result(false, error?.name === 'AbortError' ? 'timeout' : 'connection_failed');
        }
    }

    if (type === 'webdav') {
        if (!channel.baseUrl) return result(false, 'missing_configuration');
        let api;
        try {
            api = new WebDAVAPI(channel);
        } catch {
            return result(false, 'invalid_configuration');
        }
        const url = api.buildObjectUrl('');
        if (!isSafeRemoteUrl(url)) return result(false, 'unsafe_endpoint');
        const headers = api.getRequestHeaders({
            Depth: '0',
            'Content-Type': 'application/xml; charset=utf-8',
        });
        return checkHttpResponse(url, {
            method: 'PROPFIND',
            headers,
            body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>',
        }, fetcher);
    }

    return result(false, 'unsupported_type');
}

export async function onRequest({ request, env }) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
            status: 405,
            headers: { 'content-type': 'application/json' },
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON request.' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
        });
    }

    const { type, id } = body || {};
    if (!CHANNEL_TYPES.has(type) || typeof id !== 'string' || !id) {
        return new Response(JSON.stringify({ error: 'Invalid channel type or ID.' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
        });
    }

    const channels = await getUploadConfig(getDatabase(env), env);
    const channel = channels[type]?.channels?.find((item) => item.id === id);
    if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found.' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
        });
    }

    const status = await checkChannelAvailability(type, channel, env);
    return new Response(JSON.stringify(status), {
        headers: { 'content-type': 'application/json' },
    });
}
