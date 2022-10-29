import React, { useImperativeHandle } from 'react';
import { FixedSizeList, FixedSizeListProps, ListChildComponentProps } from 'react-window';

export interface SelectableListEntryProps extends ListChildComponentProps {
    selected: boolean;
}

export interface SelectableListProps extends Omit<FixedSizeListProps, 'children'> {
    onSelectionChange: (selected: number[]) => void;
    multi?: boolean;

    children: React.ComponentType<SelectableListEntryProps>;
}

export interface ListSelector {
    scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
    selectItems: (selection: number[]) => void;
}

export const SelectableList = React.forwardRef<ListSelector, SelectableListProps>((props, ref) => {
    const [selectedItems, setSelectedItems] = React.useState<readonly number[]>([]);
    const initialSelection = React.useRef<number | undefined>();
    const listRef = React.useRef<FixedSizeList>(null);

    useImperativeHandle(ref, () => ({
        scrollToItem: (index, align) => listRef?.current?.scrollToItem(index, align),
        selectItems: (s) => {
            setSelectedItems(s);
        },
    }));

    const wrapListEntry = (
        ComponentType: React.ComponentType<SelectableListEntryProps>,
        onClick: (index: number, ctrlPressed: boolean, shiftPressed: boolean) => void
    ) => {
        return (props: ListChildComponentProps) => {
            return (
                <div onClick={(ev) => onClick(props.index, ev.ctrlKey, ev.shiftKey)}>
                    <ComponentType {...props} selected={selectedItems.includes(props.index)} />
                </div>
            );
        };
    };

    const onItemClicked = (index: number, ctrlPressed: boolean, shiftPressed: boolean) => {
        let newSelection: number[] = [];
        if (ctrlPressed && props.multi) {
            initialSelection.current = initialSelection.current ?? index;
            if (selectedItems.includes(index)) {
                newSelection = selectedItems.filter((i) => i !== index);
            } else {
                newSelection = [...selectedItems, index];
            }
        } else if (shiftPressed && props.multi) {
            initialSelection.current = initialSelection.current ?? index;
            if (!selectedItems.includes(index)) {
                if (selectedItems.length === 0) {
                    newSelection = [index];
                    initialSelection.current = index;
                }
                const direction = initialSelection.current < index ? 1 : -1;
                newSelection = [];
                for (let i = initialSelection.current; i !== index + direction; i += direction) {
                    newSelection.push(i);
                }
            }
        } else {
            initialSelection.current = index;
            newSelection = [index];
        }
        setSelectedItems(newSelection);
        props.onSelectionChange?.(newSelection);
    };

    return (
        <FixedSizeList {...props} ref={listRef}>
            {wrapListEntry(props.children, onItemClicked)}
        </FixedSizeList>
    );
});
