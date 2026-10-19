import { normalizeSessionMaxAgeDays } from './sessionConfig.js';

export async function getSecurityConfig(db, env) {
  const settingsString = await db.get('manage@sysConfig@security');
  const stored = settingsString ? JSON.parse(settingsString) : {};
  const auth = stored.auth || {};
  const access = stored.access || {};

  return {
    auth: {
      user: { authCode: auth.user?.authCode ?? env.AUTH_CODE ?? '' },
      admin: {
        adminUsername: auth.admin?.adminUsername ?? env.BASIC_USER ?? '',
        adminPassword: auth.admin?.adminPassword ?? env.BASIC_PASS ?? '',
      },
    },
    access: {
      allowedDomains: access.allowedDomains || env.ALLOWED_DOMAINS || '',
      whiteListMode: access.whiteListMode ?? env.WHITE_LIST_MODE === 'true',
      sessionSecure: access.sessionSecure ?? false,
      userSessionMaxAge: normalizeSessionMaxAgeDays(access.userSessionMaxAge ?? 14),
      adminSessionMaxAge: normalizeSessionMaxAgeDays(access.adminSessionMaxAge ?? 14),
    },
    apiTokens: { tokens: stored.apiTokens?.tokens || {} },
  };
}
