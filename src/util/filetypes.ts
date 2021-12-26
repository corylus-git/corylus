export function isSupportedImageType(mimeType: string): boolean {
    return !!['image/jpeg', 'image/png', 'image/svg+xml'].find((t) => mimeType === t);
}
