import { getSiteConfig } from '../utils/siteConfig.js';

export async function onRequestGet({ env }) {
    const settings = await getSiteConfig(env);
    return Response.json(settings, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
