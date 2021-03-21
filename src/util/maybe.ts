import { immerable } from 'immer';

export interface Just<TContent> {
    found: true;
    value: TContent;
}

export class Nothing {
    found: false = false;
}

export type Maybe<TContent> = Nothing | Just<TContent>;

export const nothing = new Nothing();
export function just<TContent>(content: TContent): Just<TContent> {
    return { found: true, value: content };
}

export function unsafeDefinitely<TContent>(content: Maybe<TContent>): TContent {
    return (content as Just<TContent>).value;
}

export const fromNullable = <TContent>(content?: TContent): Maybe<TContent> =>
    content === undefined || content === null ? nothing : just(content);

export const toOptional = <TContent>(maybe: Maybe<TContent>): TContent | undefined =>
    maybe.found ? maybe.value : undefined;

export function withDefault<TContent>(maybe: Maybe<TContent>, defaultValue: TContent): TContent {
    return maybe.found ? maybe.value : defaultValue;
}

export function map<TContent, TMember>(
    maybe: Maybe<TContent>,
    accessor: (content: TContent) => TMember
): Maybe<TMember> {
    return maybe.found ? just(accessor(maybe.value)) : nothing;
}
