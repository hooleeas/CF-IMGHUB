export function isHiddenLegacyAdminPath(pathname, adminPath) {
    return (pathname === '/admin' || pathname === '/admin/') && adminPath !== '/admin';
}
