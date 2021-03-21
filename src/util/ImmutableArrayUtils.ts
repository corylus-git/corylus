export function splice<T>(
    input: readonly T[],
    start: number,
    count: number,
    ...replace: readonly T[]
): readonly T[] {
    return input
        .slice(0, start)
        .concat(replace)
        .concat(input.slice(start + count));
}

export function chunks<T>(input: readonly T[], size: number): readonly (readonly T[])[] {
    return input.reduce((existing, _, index, fullArray) => {
        if (index % size !== 0) {
            return existing;
        }
        return existing.concat([fullArray.slice(index, index + size)]);
    }, [] as readonly (readonly T[])[]);
}
