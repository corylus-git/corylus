import React, { ComponentProps, useRef } from 'react';
import styled from 'styled-components';
import CloseIcon from '../icons/CloseIcon.svg';
import { NewTab } from '../NewTab/NewTab';
import { Repository } from '../Repository';
import { useTabs } from '../../model/state/tabs';
import { Logger } from '../../util/logger';

const TabContainer = styled.div`
    display: grid;
    grid-template-rows: 2rem 1fr;
    height: 100%;
`;

const TabHeader = styled.nav`
    position: relative;
    display: grid;
    border-bottom: 1px solid var(--border);
    height: 2rem;
    grid-template-columns: 1fr 2rem;

    .scroll-container {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        width: 100%;

        .tabs-header-container {
            display: flex;
            overflow: hidden;
            height: 2rem;
        }
    }
`;

const TabDiv = styled.div<{ active: boolean } & ComponentProps<'div'>>`
    min-width: 10rem;
    max-width: 15rem;
    margin-left: -1px; // collapse the border with the neighboring div
    padding-left: 0.5rem;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-collapse: collapse;
    background-color: ${(props) => (props.active ? 'var(--selected)' : undefined)};
    :hover {
        background-color: var(--highlight);
    }
    display: grid;
    grid-template-columns: 1fr 1.1rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    flex-grow: 1;
`;

const StyledCloseIcon = styled(CloseIcon)`
    cursor: pointer;
`;

const Tab = React.forwardRef(
    (
        props: {
            active: boolean;
            label: string;
            title?: string;
            onClick?: (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
            onClose: () => void;
        },
        ref: React.ForwardedRef<HTMLDivElement>
    ) => (
        <TabDiv active={!!props.active} onClick={props.onClick} title={props.title} ref={ref}>
            <span>{props.label}</span>
            <StyledCloseIcon
                viewBox="0 0 24 24"
                width="1rem"
                height="1rem"
                onClick={(ev) => {
                    props.onClose();
                    ev.stopPropagation();
                }}
            />
        </TabDiv>
    )
);

const TabContent = styled.div`
    height: 100%;
`;

const NavButton = styled.button`
    border: none;
    margin-left: -1px; // collapse the border with the neighboring div
    border-left: solid 1px var(--border);
    border-right: solid 1px var(--border);
    color: var(--foreground);
    background-color: var(--background);
    width: 2rem;
    padding: 0;
    font-size: 150%;
    font-weight: 100;
    text-align: center;
    cursor: pointer;
    height: 2rem;
`;

function doScroll(
    left: boolean,
    scrollRef: React.RefObject<HTMLDivElement>,
    leftRef: React.RefObject<HTMLButtonElement>,
    rightRef: React.RefObject<HTMLButtonElement>
) {
    scrollRef.current?.scrollBy({ left: left ? -5 : 5, top: 0 });
    showScrollButtons(scrollRef, leftRef, rightRef);
}

function showScrollButtons(
    scrollRef: React.RefObject<HTMLDivElement>,
    leftRef: React.RefObject<HTMLButtonElement>,
    rightRef: React.RefObject<HTMLButtonElement>
) {
    if (leftRef.current) {
        if (scrollRef.current?.scrollLeft === 0) {
            leftRef.current.style.visibility = 'hidden';
        } else {
            leftRef.current.style.visibility = 'visible';
        }
    }
    if (rightRef.current) {
        if (
            scrollRef.current &&
            scrollRef.current.scrollLeft + scrollRef.current.clientWidth <
            scrollRef.current.scrollWidth
        ) {
            rightRef.current.style.visibility = 'visible';
        } else {
            rightRef.current.style.visibility = 'hidden';
        }
    }
}

/**
 * An extendable tab component
 */
export const Tabs: React.FC = () => {
    const tabs = useTabs();
    const leftRef = React.createRef<HTMLButtonElement>();
    const rightRef = React.createRef<HTMLButtonElement>();
    const scrollRef = React.createRef<HTMLDivElement>();
    const intervalRef = React.useRef(0);
    const activeRef = React.createRef<HTMLDivElement>();

    React.useEffect(() => showScrollButtons(scrollRef, leftRef, rightRef), [
        scrollRef.current,
        tabs,
    ]);
    React.useEffect(() => {
        Logger().silly('Tabs', 'Scrolling new active tab into view', { active: tabs.active });
        activeRef.current?.scrollIntoView();
    }, [tabs.active]);

    return (
        <TabContainer onMouseUp={() => intervalRef.current && clearInterval(intervalRef.current)}>
            <TabHeader>
                <div className="scroll-container">
                    <NavButton
                        ref={leftRef}
                        style={{
                            position: 'absolute',
                            left: 0,
                        }}
                        onMouseDown={(_) => {
                            intervalRef.current = window.setInterval(
                                () => doScroll(true, scrollRef, leftRef, rightRef),
                                16
                            );
                        }}>
                        &lt;
                    </NavButton>
                    <div className="tabs-header-container" ref={scrollRef}>
                        {tabs.tabs.map((tab) => (
                            <Tab
                                ref={tabs.active.found && tabs.active.value === tab.id ? activeRef : undefined}
                                label={tab.title}
                                active={tabs.active.found && tabs.active.value === tab.id}
                                key={tab.id}
                                title={(tab.path.found && tab.path.value) || undefined}
                                onClose={() => tabs.closeTab(tab.id)}
                                onClick={tabs.active.found && tabs.active.value === tab.id ? undefined : () => tabs.switchTab(tab)}
                            />

                        ))}
                    </div>

                    <NavButton
                        ref={rightRef}
                        onMouseDown={(_) => {
                            intervalRef.current = window.setInterval(
                                () => doScroll(false, scrollRef, leftRef, rightRef),
                                16
                            );
                        }}
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            display: 'inline-block',
                        }}>
                        &gt;
                    </NavButton>
                </div>
                <div>
                    <NavButton onClick={(_) => tabs.addTab()}>+</NavButton>
                </div>
            </TabHeader>
            <TabContent>
                {tabs.active.found ? (
                    tabs.tabs.find(t => tabs.active.found && t.id === tabs.active.value)?.path?.found ? (
                        <Repository />
                    ) : (
                        <NewTab />
                    )
                ) : (
                    <></>
                )}
            </TabContent>
        </TabContainer>
    );
};
