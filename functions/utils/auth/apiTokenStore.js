export async function createApiToken(db, name, permissions, owner, expiresAt = null, autoDelete = false, type = 'user') {
  const settingsString = await db.get('manage@sysConfig@security');
  const settings = settingsString ? JSON.parse(settingsString) : {};
  settings.apiTokens ||= { tokens: {} };

  const idBytes = new Uint8Array(12);
  crypto.getRandomValues(idBytes);
  const tokenId = Array.from(idBytes, (BYTE) => BYTE.toString(16).padStart(2, '0')).join('');
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = `imgbed_${Array.from(tokenBytes, (BYTE) => BYTE.toString(16).padStart(2, '0')).join('')}`;
  const now = new Date().toISOString();
  const tokenData = {
    id: tokenId,
    name,
    token,
    owner,
    permissions,
    type,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiresAt ?? null,
    autoDelete: autoDelete === true,
  };

  settings.apiTokens.tokens[tokenId] = tokenData;
  await db.put('manage@sysConfig@security', JSON.stringify(settings));
  return { ...tokenData };
}

export async function deleteApiToken(db, tokenId) {
  const settingsString = await db.get('manage@sysConfig@security');
  const settings = settingsString ? JSON.parse(settingsString) : {};
  if (!settings.apiTokens?.tokens?.[tokenId]) return { error: 'Token 不存在' };

  delete settings.apiTokens.tokens[tokenId];
  await db.put('manage@sysConfig@security', JSON.stringify(settings));
  return { success: true, message: 'Token 已删除' };
}

export async function getTokenData(db, token) {
  const settingsString = await db.get('manage@sysConfig@security');
  const settings = settingsString ? JSON.parse(settingsString) : {};
  const storedTokens = settings.apiTokens?.tokens || {};

  for (const tokenData of Object.values(storedTokens)) {
    if (tokenData.token === token) {
      return {
        id: tokenData.id,
        name: tokenData.name,
        token: tokenData.token,
        owner: tokenData.owner,
        permissions: tokenData.permissions,
        type: tokenData.type || 'user',
        createdAt: tokenData.createdAt,
        updatedAt: tokenData.updatedAt,
        expiresAt: tokenData.expiresAt ?? null,
        autoDelete: tokenData.autoDelete ?? false,
      };
    }
  }

  return null;
}
