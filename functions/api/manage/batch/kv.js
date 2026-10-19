import { removeDefaultMetadata } from '../../../utils/metadata/defaultMetadata.js';

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 10_000;
const PAGE_SIZE = 100;
const WRITE_BATCH_SIZE = 50;

function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

function getKV(env) {
    if (!env.KV || typeof env.KV.list !== 'function') {
        throw new Error('当前部署没有配置 KV 命名空间，无法进行 KV 备份与迁移。');
    }
    return env.KV;
}

function parseEntryValue(value) {
    if (value === null) {
        return { value: '', raw: '' };
    }
    try {
        const parsed = JSON.parse(value);
        return {
            value: JSON.stringify(parsed, null, 2),
            raw: typeof parsed === 'string' ? value : parsed,
        };
    } catch {
        return { value, raw: value };
    }
}

async function listEntries(kv, cursor) {
    const result = await kv.list({
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
    });
    const entries = result.keys.map(({ name }) => ({ name }));
    entries.sort((left, right) => left.name.localeCompare(right.name));

    return {
        entries,
        cursor: result.list_complete ? null : result.cursor || null,
    };
}

async function readJsonRequest(request) {
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return { response: jsonResponse({ ok: false, error: '请求来源无效。' }, 403) };
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return { response: jsonResponse({ ok: false, error: '请求格式无效。' }, 415) };
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_IMPORT_BYTES) {
        return { response: jsonResponse({ ok: false, error: '备份文件过大，单次导入上限为 20 MB。' }, 413) };
    }

    const reader = request.body?.getReader();
    if (!reader) {
        return { response: jsonResponse({ ok: false, error: '请求内容为空。' }, 400) };
    }

    const chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMPORT_BYTES) {
            await reader.cancel();
            return { response: jsonResponse({ ok: false, error: '备份文件过大，单次导入上限为 20 MB。' }, 413) };
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return { data: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
        return { response: jsonResponse({ ok: false, error: '请求内容不是有效的 JSON。' }, 400) };
    }
}

async function importEntries(kv, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return jsonResponse({ ok: false, error: '导入内容必须是一个 JSON 对象。' }, 400);
    }

    const entries = Object.entries(payload);
    if (entries.length > MAX_IMPORT_ENTRIES) {
        return jsonResponse({ ok: false, error: '单次最多导入 10,000 个 KV 项目。' }, 413);
    }

    const encoder = new TextEncoder();
    const validated = [];
    for (const [key, value] of entries) {
        if (!key || encoder.encode(key).byteLength > 512 || /[\u0000-\u001f\u007f]/.test(key)) {
            return jsonResponse({ ok: false, error: `KV 键名无效或超过 512 字节：${key.slice(0, 80)}` }, 400);
        }
        const storedValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        if (storedValue === undefined) {
            return jsonResponse({ ok: false, error: `KV 项目“${key}”包含无法保存的数据。` }, 400);
        }
        validated.push([key, storedValue]);
    }

    try {
        for (let index = 0; index < validated.length; index += WRITE_BATCH_SIZE) {
            await Promise.all(validated.slice(index, index + WRITE_BATCH_SIZE).map(
                ([key, value]) => kv.put(key, value)
            ));
        }
    } catch (error) {
        console.error('KV backup import failed:', error);
        return jsonResponse({
            ok: false,
            error: '导入未能全部完成，部分 KV 项目可能已写入，请检查后重试。',
        }, 500);
    }

    return jsonResponse({ ok: true, count: validated.length });
}

async function resetKV(kv) {
    const keys = [];
    let cursor;
    do {
        const result = await kv.list(cursor ? { cursor } : {});
        keys.push(...result.keys.map(({ name }) => name));
        cursor = result.list_complete ? null : result.cursor || null;
    } while (cursor);

    let deleted = 0;
    try {
        for (let index = 0; index < keys.length; index += WRITE_BATCH_SIZE) {
            const batch = keys.slice(index, index + WRITE_BATCH_SIZE);
            await Promise.all(batch.map((key) => kv.delete(key)));
            deleted += batch.length;
        }
    } catch (error) {
        console.error('KV factory reset stopped after partial deletion:', error);
        return jsonResponse({
            ok: false,
            error: `恢复出厂设置未能完成，已删除 ${deleted} 项 KV 数据。`,
            deleted,
        }, 500);
    }

    return jsonResponse({ ok: true, deleted });
}

async function cleanDefaultMetadata(kv, confirmation) {
    if (confirmation !== 'CLEAN_METADATA_DEFAULTS') {
        return jsonResponse({ ok: false, error: '确认文本无效。' }, 400);
    }
    if (typeof kv.getWithMetadata !== 'function') {
        return jsonResponse({ ok: false, error: '当前 KV 不支持读取文件元数据。' }, 501);
    }

    const removedFields = {};
    let updatedEntries = 0;
    let cursor;

    try {
        do {
            const result = await kv.list({
                limit: PAGE_SIZE,
                ...(cursor ? { cursor } : {}),
            });
            for (const { name } of result.keys) {
                if (name === 'manage@index@meta') {
                    const value = await kv.get(name);
                    if (value === null) continue;
                    const metadata = JSON.parse(value);
                    if (Object.hasOwn(metadata, 'chunkSize')) {
                        delete metadata.chunkSize;
                        await kv.put(name, JSON.stringify(metadata));
                        updatedEntries++;
                        removedFields.chunkSize = (removedFields.chunkSize || 0) + 1;
                    }
                    continue;
                }

                if (/^manage@index(?:_\d+)?$/.test(name)) {
                    const value = await kv.get(name);
                    if (value === null) continue;
                    const chunks = JSON.parse(value);
                    if (!Array.isArray(chunks)) continue;

                    let changed = false;
                    const fieldsRemovedFromChunk = {};
                    const cleanedChunks = chunks.map((file) => {
                        if (!file?.metadata) return file;
                        const cleaned = removeDefaultMetadata(file.metadata);
                        if (cleaned.removedFields.length === 0) return file;
                        changed = true;
                        for (const field of cleaned.removedFields) {
                            fieldsRemovedFromChunk[field] = (fieldsRemovedFromChunk[field] || 0) + 1;
                        }
                        return { ...file, metadata: cleaned.metadata };
                    });

                    if (changed) {
                        await kv.put(name, JSON.stringify(cleanedChunks));
                        updatedEntries++;
                        for (const [field, count] of Object.entries(fieldsRemovedFromChunk)) {
                            removedFields[field] = (removedFields[field] || 0) + count;
                        }
                    }
                    continue;
                }

                if (name.startsWith('manage@')) continue;
                const entry = await kv.getWithMetadata(name);
                if (!entry?.metadata) continue;

                const cleaned = removeDefaultMetadata(entry.metadata);
                if (cleaned.removedFields.length === 0) continue;

                await kv.put(name, entry.value ?? '', { metadata: cleaned.metadata });
                updatedEntries++;
                for (const field of cleaned.removedFields) {
                    removedFields[field] = (removedFields[field] || 0) + 1;
                }
            }

            cursor = result.list_complete ? null : result.cursor || null;
        } while (cursor);
    } catch (error) {
        console.error('KV default metadata cleanup stopped after partial updates:', error);
        return jsonResponse({
            ok: false,
            error: `清理未能全部完成，已更新 ${updatedEntries} 项 KV 数据。`,
            updatedEntries,
            removedFields,
        }, 500);
    }

    return jsonResponse({ ok: true, updatedEntries, removedFields });
}

export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        if (url.searchParams.has('key')) {
            const key = url.searchParams.get('key');
            if (!key) return jsonResponse({ ok: false, error: 'KV 键名不能为空。' }, 400);
            const value = await getKV(env).get(key);
            if (value === null) return jsonResponse({ ok: false, error: 'KV 项目不存在或已被删除。' }, 404);
            return jsonResponse({ entry: { name: key, ...parseEntryValue(value) } });
        }
        const cursor = url.searchParams.get('cursor');
        const page = await listEntries(getKV(env), cursor);
        return jsonResponse(page);
    } catch (error) {
        console.error('KV backup listing failed:', error);
        return jsonResponse({ ok: false, error: error.message || '读取 KV 数据失败。' }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const result = await readJsonRequest(request);
        if (result.response) return result.response;
        const kv = getKV(env);

        if (result.data?.type === 'factory_reset') {
            if (result.data.confirmation !== 'DELETE') {
                return jsonResponse({ ok: false, error: '确认文本无效，请输入 DELETE。' }, 400);
            }
            return await resetKV(kv);
        }
        if (result.data?.type === 'clean_default_metadata') {
            return await cleanDefaultMetadata(kv, result.data.confirmation);
        }
        if (result.data?.type !== 'import_all_json') {
            return jsonResponse({ ok: false, error: '不支持的操作类型。' }, 400);
        }
        return await importEntries(kv, result.data.payload);
    } catch (error) {
        console.error('KV backup request failed:', error);
        return jsonResponse({ ok: false, error: error.message || '备份与迁移操作失败。' }, 500);
    }
}

export async function onRequest(context) {
    if (context.request.method === 'GET') return onRequestGet(context);
    if (context.request.method === 'POST') return onRequestPost(context);
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
}
