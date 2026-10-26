import assert from 'node:assert/strict';
import test from 'node:test';
import { isHiddenLegacyAdminPath } from '../functions/utils/adminPathRouting.js';
import { onRequest as pagesMiddleware } from '../functions/_middleware.js';

const siteConfigKey = 'manage@sysConfig@site';

function createEnv(adminPath) {
    return {
        KV: {
            async get(key) {
                if (key === siteConfigKey) return JSON.stringify({ adminPath });
                return null;
            },
            async put() {},
            async delete() {},
        },
    };
}

test('Pages hides the legacy admin path after a custom path is configured', async () => {
    for (const path of ['/admin', '/admin/']) {
        const response = await pagesMiddleware({
            request: new Request(`https://example.test${path}`, {
                headers: { Accept: 'text/html' },
            }),
            env: createEnv('/asia'),
            next: () => new Response('next'),
        });

        assert.equal(response.status, 404);
        assert.equal(response.headers.has('location'), false);
        assert.match(await response.text(), /Page not found/);
    }
});

test('Pages keeps the configured admin path and default admin path working', async () => {
    for (const [path, adminPath] of [['/asia', '/asia'], ['/admin', '/admin']]) {
        const response = await pagesMiddleware({
            request: new Request(`https://example.test${path}`, {
                headers: { Accept: 'text/html' },
            }),
            env: createEnv(adminPath),
            next: () => new Response('next'),
        });

        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'next');
    }
});

test('legacy path hiding only applies after a custom path is configured', () => {
    assert.equal(isHiddenLegacyAdminPath('/admin', '/asia'), true);
    assert.equal(isHiddenLegacyAdminPath('/admin/', '/asia'), true);
    assert.equal(isHiddenLegacyAdminPath('/admin', '/admin'), false);
    assert.equal(isHiddenLegacyAdminPath('/asia', '/asia'), false);
});
