import { getSiteConfig, saveSiteConfig } from '../../../utils/siteConfig.js';

const RESERVED_ADMIN_PATHS = new Set(['api', 'upload', 'file', 'dav', 'random', 'adminlogin', 'login']);

export async function onRequestGet({ env }) {
    const settings = await getSiteConfig(env);
    return Response.json(settings, {
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

export async function onRequestPost({ request, env }) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 8192) {
        return Response.json({ error: '请求内容过大。' }, { status: 413 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '请求格式无效。' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return Response.json({ error: '请求格式无效。' }, { status: 400 });
    }

    const requestedPath = typeof body.adminPath === 'string' ? body.adminPath.trim() : '';
    const pathSegment = requestedPath.replace(/^\/+|\/+$/g, '');
    const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(pathSegment) || RESERVED_ADMIN_PATHS.has(pathSegment.toLowerCase())) {
        return Response.json({ error: '管理路径只能包含字母、数字、下划线或连字符，长度为 1 到 128 个字符。' }, { status: 400 });
    }
    if (!siteName || siteName.length > 100) {
        return Response.json({ error: '站点名称不能为空且不能超过 100 个字符。' }, { status: 400 });
    }

    const settings = await saveSiteConfig(env, { adminPath: `/${pathSegment}`, siteName });
    return Response.json({ ok: true, ...settings });
}
