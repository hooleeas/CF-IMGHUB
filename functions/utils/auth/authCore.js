import { fetchSecurityConfig } from '../sysConfig.js';
import { validateSession } from './sessionManager.js';

export const AUTH_SCOPE = {
    ADMIN: 'admin',
    USER: 'user',
    EITHER: 'either',
};

export async function authenticate({ env, request, authScope = AUTH_SCOPE.EITHER } = {}) {
    if (authScope === AUTH_SCOPE.USER) {
        return { authorized: true, authType: 'user' };
    }

    const securityConfig = await fetchSecurityConfig(env, { throwOnError: true });
    const admin = securityConfig.auth.admin;
    const adminRequired = Boolean(admin.adminUsername && admin.adminPassword);
    if (!adminRequired) {
        return { authorized: true, authType: 'admin' };
    }

    const session = await validateSession(env, request, 'admin');
    return {
        authorized: session.valid,
        authType: session.valid ? 'admin' : null,
    };
}
