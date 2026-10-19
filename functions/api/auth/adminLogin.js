import { getSecurityConfig } from '../../utils/auth/securityConfig.js';
import { verifyPassword } from '../../utils/auth/passwordHash.js';
import { createSession } from '../../utils/auth/sessionManager.js';
import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequestPost({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '请求格式无效。' }, { status: 400 });
    }

    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const config = await getSecurityConfig(getDatabase(env), env);
    const expectedUsername = config.auth.admin.adminUsername;
    const expectedPassword = config.auth.admin.adminPassword;
    if (!expectedUsername || !expectedPassword
        || username !== expectedUsername
        || !await verifyPassword(password, expectedPassword)) {
        return Response.json({ error: '用户名或密码错误。' }, {
            status: 401,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const session = await createSession(env, 'admin', username);
    return Response.json({ ok: true }, {
        headers: {
            'Set-Cookie': session.cookie,
            'Cache-Control': 'no-store',
        },
    });
}
