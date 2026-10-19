import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeSystemConfigValue } from '../functions/utils/sysConfigStorage.js';
import { getSiteConfig } from '../functions/utils/siteConfig.js';

function createKV(siteConfig) {
    const values = new Map();
    if (siteConfig) {
        values.set('MANAGE@SYSCONFIG@SITE', encodeSystemConfigValue(JSON.stringify(siteConfig)));
    }
    return {
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
    };
}

test('uses cf-imghub as the default site name', async () => {
    assert.deepEqual(await getSiteConfig({ KV: createKV() }), {
        adminPath: '/admin',
        siteName: 'cf-imghub',
    });
});

test('renames the previous default while preserving custom site names', async () => {
    for (const previousName of ['ImgBed', 'ImgHub', 'Cloudflare ImgBed']) {
        assert.equal((await getSiteConfig({
            KV: createKV({ siteName: previousName }),
        })).siteName, 'cf-imghub');
    }
    assert.equal((await getSiteConfig({
        KV: createKV({ siteName: 'My Image Site' }),
    })).siteName, 'My Image Site');
});
