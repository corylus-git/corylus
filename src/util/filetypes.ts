export function getFileType(fileName: string): string | null {
    if (fileName.match(/\.jp(e*)g/)) {
        return 'image/jpeg';
    }
    if (fileName.endsWith('.png')) {
        return 'image/png';
    }
    if (fileName.match(/\.svg(z*)/)) {
        return 'image/svg+xml';
    }

    return null;
}
