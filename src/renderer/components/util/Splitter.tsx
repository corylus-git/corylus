import * as React from 'react';
import '../../../style/app.css';
import styled from 'styled-components';

export const SplitterPanel = styled.div`
    min-width: 100%;
    max-width: 100%;
    width: 0;
    min-height: 100%;
    max-height: 100%;
    height: 0;
    overflow: auto;
`;

const HSep = styled.div`
    padding-top: 5px;
    padding-bottom: 5px;
    cursor: ns-resize;
`;

const VSep = styled.div`
    padding-left: 5px;
    padding-right: 5px;
    cursor: ew-resize;
`;

const SplitterBar = styled.div`
    height: 100%;
    width: 100%;
    background-color: var(--border);
`;

/**
 * A configurable splitter component
 *
 * @param props properties of the component
 * @param props.noWrap Do not wrap the child components in scrollable containers. This means, that the child components will have to take care of the scrolling and overflow themselves.
 * @param props.onMove Callback to inform surrounding components about a move of the splitter
 */
export const Splitter: React.FC<{
    children: JSX.Element[];
    horizontal?: boolean;
    initialPosition?: string;
    noWrap?: boolean;
    onMove?: (position: number) => void;
}> = (props) => {
    const dragging = React.useRef(false);
    const absContainerPos = React.useRef({ top: 0, left: 0 });
    const [splitterPosition, setSplitterPosition] = React.useState(
        props.initialPosition ?? '300px'
    );
    const gridStyle: any = {
        display: 'grid',
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
    };

    if (props.horizontal) {
        gridStyle.gridTemplateRows = `${splitterPosition} 11px minmax(0,1fr)`;
        gridStyle.width = '100%';
    } else {
        gridStyle.gridTemplateColumns = `${splitterPosition} 11px minmax(0,1fr)`;
        gridStyle.height = '100%';
    }
    const containerRef = React.useRef<HTMLDivElement>(null);
    const Sep = props.horizontal ? HSep : VSep;

    return (
        <div
            style={gridStyle}
            ref={containerRef}
            onMouseMove={(ev) => {
                if (dragging.current) {
                    const newPos = props.horizontal
                        ? ev.clientY - absContainerPos.current.top - 5
                        : ev.clientX - absContainerPos.current.left - 5;
                    setSplitterPosition(`${newPos}px`);
                    props.onMove?.(newPos);
                }
            }}
            onMouseUp={() => (dragging.current = false)}>
            {props.noWrap ? props.children[0] : <SplitterPanel>{props.children[0]}</SplitterPanel>}
            <Sep
                onMouseDown={() => {
                    dragging.current = true;
                    const containerPos = containerRef.current?.getBoundingClientRect();
                    const viewPortPos = { x: window.scrollX, y: window.scrollY };
                    absContainerPos.current = {
                        top: (containerPos?.top ?? 0) + viewPortPos.y,
                        left: (containerPos?.left ?? 0) + viewPortPos.x,
                    };
                }}
                onMouseUp={() => (dragging.current = false)}>
                <SplitterBar />
            </Sep>
            {props.noWrap ? props.children[1] : <SplitterPanel>{props.children[1]}</SplitterPanel>}
        </div>
    );
};
