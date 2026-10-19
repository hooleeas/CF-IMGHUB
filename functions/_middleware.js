import { getSiteConfig } from './utils/siteConfig.js';

export async function onRequest(context) {
    const url = new URL(context.request.url);
    if (url.pathname !== '/admin' && url.pathname !== '/admin/') {
        return context.next();
    }

    const { adminPath } = await getSiteConfig(context.env);
    if (adminPath === '/admin') return context.next();

    url.pathname = adminPath;
    return Response.redirect(url, 302);
}
