import { validateSession } from '../../utils/auth/sessionManager.js';
import { fetchSecurityConfig } from '../../utils/sysConfig.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const securityConfig = await fetchSecurityConfig(env, { throwOnError: true });
    const admin = securityConfig.auth.admin;
    const adminRequired = Boolean(admin.adminUsername && admin.adminPassword);
    const session = await validateSession(env, request, 'admin');

    return new Response(JSON.stringify({
        valid: !adminRequired || session.valid,
        authType: session.valid ? 'admin' : null,
        adminRequired,
        userRequired: Boolean(securityConfig.auth.user.authCode),
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}
