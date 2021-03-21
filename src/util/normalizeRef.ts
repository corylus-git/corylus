/**t
 * Perform all ref-name normalizations, that can be done without any
 * context (i.e. special characters, that are always replaced)
 *
 * @param input The input to normalize
 */
export function preNormalize(input: string): string {
    return input
        .replace(/^[./]|\.\.|@{|[~^:\x00-\x20\x7F\s?*[\\]|\/\//g, '-')
        .replace(/\.(lock\/)/g, '-$1')
        .replace(/^-/, 'branch-');
}

/**
 * Perform normalization of special characters, that depend on the surrounding context
 * (i.e. dots before / or / at end the ref name)
 *
 * @param input The input to normalize
 */
export function postNormalize(input: string | undefined): string | undefined {
    return input?.replace(/[/.]$|^@$/g, '-').replace(/\.(lock)$/g, '-$1');
}
