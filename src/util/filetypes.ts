export function isSupportedImageType(mimeType: string): boolean {
    return !!['image/jpeg', 'image/png', 'image/svg+xml'].find((t) => mimeType === t);
}

// TODO I don't like this way of detecting the MIME type
export function getMimeType(path: string): string {
    const normalizedPath = path.toLowerCase();
    if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (normalizedPath.endsWith('.png')) {
        return 'image/png';
    }
    if (normalizedPath.endsWith('.svg')) {
        return 'image/svg+xml';
    }
    return 'application/binary';
}