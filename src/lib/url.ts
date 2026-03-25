function normalizeHostnameCandidate(rawValue: string): string {
    const trimmed = rawValue.trim().toLowerCase().replace(/\.$/, '');
    if (!trimmed) {
        return '';
    }

    if (trimmed.startsWith('[')) {
        const closingBracketIndex = trimmed.indexOf(']');
        if (closingBracketIndex >= 0) {
            return trimmed.slice(1, closingBracketIndex);
        }
    }

    const colonCount = trimmed.split(':').length - 1;
    if (colonCount === 1) {
        return trimmed.split(':')[0] ?? '';
    }

    return trimmed;
}

export function isLocalHostname(rawValue: string): boolean {
    const hostname = normalizeHostnameCandidate(rawValue);

    return hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname === '::1'
        || hostname === '0.0.0.0'
        || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export const normalizePreviewUrl = (rawValue: string): string | null => {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null;
    if (/^(mailto|javascript|data|tel):/i.test(trimmed)) return null;

    const firstSegment = trimmed.split('/')[0] ?? '';
    const colonIndex = firstSegment.indexOf(':');
    if (colonIndex > 0 && !firstSegment.startsWith('[')) {
        const hostCandidate = firstSegment.slice(0, colonIndex).toLowerCase();
        const trailing = firstSegment.slice(colonIndex + 1);
        const isLikelyHostWithPort = hostCandidate.includes('.')
            || hostCandidate === 'localhost'
            || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostCandidate)
            || /^\d+$/.test(trailing);
        if (!isLikelyHostWithPort) return null;
    }

    const hostPort = firstSegment.includes('@') ? firstSegment.slice(firstSegment.lastIndexOf('@') + 1) : firstSegment;
    const protocol = isLocalHostname(hostPort) ? 'http' : 'https';
    return `${protocol}://${trimmed}`;
};
