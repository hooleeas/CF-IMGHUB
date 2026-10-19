import { getDatabase } from '../../../utils/databaseAdapter.js';
import { destroySessionsByAuthType, createSession } from '../../../utils/auth/sessionManager.js';
import { hashPassword } from '../../../utils/auth/passwordHash.js';
import { fetchSecurityConfig } from '../../../utils/sysConfig.js';

function getAdminCredentials(config) {
    return {
        username: config.auth.admin.adminUsername || '',
        password: config.auth.admin.adminPassword || '',
    };
}

export async function onRequestGet({ env }) {
    const config = await fetchSecurityConfig(env, { throwOnError: true });
    const { username, password } = getAdminCredentials(config);
    const db = getDatabase(env);
    const settingsString = await db.get('manage@sysConfig@security');
    const stored = settingsString ? JSON.parse(settingsString) : {};
    const userPassword = config.auth.user.authCode || '';
    const ipQuery = stored.upload?.ipQuery || {};
    config.upload = {
        moderate: {
            enabled: stored.upload?.moderate?.enabled ?? false,
            channel: stored.upload?.moderate?.channel || 'moderatecontent.com',
            moderateContentApiKey: stored.upload?.moderate?.moderateContentApiKey
                || stored.upload?.moderate?.apiKey
                || env.ModerateContentApiKey
                || '',
            nsfwApiPath: stored.upload?.moderate?.nsfwApiPath || '',
        },
        ipQuery: {
            enabled: ipQuery.enabled ?? false,
            channel: ipQuery.channel || 'customApi',
            customApi: {
                url: ipQuery.customApi?.url || '',
                params: Array.isArray(ipQuery.customApi?.params) && ipQuery.customApi.params.length
                    ? ipQuery.customApi.params.map((item) => ({ key: item?.key || '', value: item?.value || '' }))
                    : [{ key: 'ip', value: '{ip}' }],
                responseFields: Array.isArray(ipQuery.customApi?.responseFields)
                    ? ipQuery.customApi.responseFields.map((item) => typeof item === 'string' ? item : item?.path || '')
                    : [],
            },
        },
    };
    config.auth.user._hasPassword = Boolean(userPassword);
    config.auth.user.authCode = '';
    config.auth.admin._hasPassword = Boolean(password);
    config.auth.admin.adminPassword = '';
    config.apiTokens = { tokens: {} };
    return Response.json({
        ...config,
        adminRequired: Boolean(username && password),
        username,
        passwordConfigured: Boolean(password),
    }, {
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

    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmation = typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : '';
    const validationError = !username || username.length > 256 || /[:\u0000-\u001f\u007f]/.test(username)
        ? '请输入有效用户名（最多 256 个字符，不能包含冒号或控制字符）。'
        : password.length < 8 || password.length > 1024
            ? '管理员密码至少需要 8 个字符。'
            : password !== confirmation
                ? '两次输入的密码不一致。'
                : '';
    if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
    }

    const db = getDatabase(env);
    const previous = await fetchSecurityConfig(env, { throwOnError: true });
    const previousCredentials = getAdminCredentials(previous);
    const storedString = await db.get('manage@sysConfig@security');
    const stored = storedString ? JSON.parse(storedString) : {};
    const wasConfigured = Boolean(previousCredentials.username && previousCredentials.password);
    stored.auth = stored.auth || {};
    stored.auth.admin = {
        ...(stored.auth.admin || {}),
        adminUsername: username,
        adminPassword: await hashPassword(password),
    };
    await db.put('manage@sysConfig@security', JSON.stringify(stored));

    if (wasConfigured) {
        await destroySessionsByAuthType(env, 'admin');
        return Response.json({ ok: true, adminPasswordChanged: true });
    }

    const session = await createSession(env, 'admin', username);
    return Response.json({ ok: true, adminPasswordChanged: false }, {
        headers: { 'Set-Cookie': session.cookie },
    });
}
