import { destroySession } from '../../utils/auth/sessionManager.js';

export async function onRequestPost({ request, env }) {
    const cookies = await destroySession(env, request, 'admin');
    return Response.json({ ok: true }, {
        headers: {
            'Set-Cookie': cookies,
            'Cache-Control': 'no-store',
        },
    });
}
