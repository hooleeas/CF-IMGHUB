import assert from 'node:assert/strict';
import test from 'node:test';
import { notFoundResponse } from '../functions/utils/notFoundResponse.js';

test('returns a bilingual 404 page with a home link', async () => {
    const response = notFoundResponse(new Request('https://example.test/missing'));
    const html = await response.text();

    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /页面不存在/);
    assert.match(html, /Page not found/);
    assert.match(html, /href="\/"/);
});

test('returns an empty body for HEAD requests', async () => {
    const response = notFoundResponse(new Request('https://example.test/missing', { method: 'HEAD' }));

    assert.equal(response.status, 404);
    assert.equal(await response.text(), '');
});