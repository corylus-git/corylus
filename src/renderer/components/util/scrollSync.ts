import { Logger } from '../../../util/logger';
import * as monaco from 'monaco-editor';

export function attachScrollHandlers(
    editors: (monaco.editor.ICodeEditor | undefined)[],
    auxillaryColumns: (HTMLDivElement | null)[],
    onScroll?: (top: number) => void
): void {
    const scrollAll = (top: number) => {
        editors.forEach((e) => {
            e!.getScrollTop() !== top && e!.setScrollTop(top);
        });
        auxillaryColumns.forEach((c) => c?.scrollTo(0, top));
        onScroll?.(top);
    };

    if (editors.every((e) => !!e) && auxillaryColumns.every((c) => !!c)) {
        Logger().silly('attachScrollHandlers', 'Attaching scroll sync to editors and columns');
        // only attach the scroll sync when all editors have successfully mounted
        editors.forEach((e) => {
            e!.onDidScrollChange((ev) => scrollAll(ev.scrollTop));
        });
    }
}
