import React, { ComponentProps } from 'react';
import styled from 'styled-components';
import CloseIcon from '../icons/CloseIcon.svg';
import { unsafeDefinitely } from '../../../util/maybe';
import { NewTab } from '../NewTab/NewTab';
import { Repository } from '../Repository';
import { useTabs } from '../../../model/state/tabs';

const TabContainer = styled.div`
    display: grid;
    grid-template-rows: 1.5rem 1fr;
    height: 100%;
`;

const TabHeader = styled.nav`
    display: flex;
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
`;

const TabPanel = styled.div`
    height: 100%;
`;

const TabDiv = styled.div<{ active: boolean } & ComponentProps<'div'>>`
    min-width: 10rem;
    max-width: 15rem;
    margin-left: -1px; // collapse the border with the neighboring div
    padding-left: 0.5rem;
    border-left: 1px solid ${(props) => props.theme.colors.border};
    border-right: 1px solid ${(props) => props.theme.colors.border};
    border-collapse: collapse;
    background-color: ${(props) => (props.active ? props.theme.colors.selected : undefined)};
    :hover {
        background-color: ${(props) => props.theme.colors.highlight};
    }
    display: grid;
    grid-template-columns: 1fr 1.1rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
`;

const StyledCloseIcon = styled(CloseIcon)`
    cursor: pointer;
`;

const Tab: React.FC<{
    active: boolean;
    label: string;
    onClick?: (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    onClose: () => void;
}> = (props) => (
    <TabDiv active={!!props.active} onClick={props.onClick}>
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
);

const TabContent = styled.div`
    height: 100%;
`;

const AddButton = styled.div`
    margin-left: -1px; // collapse the border with the neighboring div
    border-left: solid 1px ${(props) => props.theme.colors.border};
    border-right: solid 1px ${(props) => props.theme.colors.border};
    width: 2rem;
    padding: 0;
    font-size: 150%;
    font-weight: 100;
    text-align: center;
    cursor: pointer;
`;

/**
 * An extendable tab component
 *
 * @param props The properties of this element
 */
export const Tabs: React.FC = () => {
    const tabs = useTabs();
    return (
        <TabContainer>
            <TabHeader>
                {tabs.left.map((tab) => (
                    <Tab
                        label={tab.title}
                        active={false}
                        key={tab.id}
                        onClose={() => tabs.closeTab(tab.id)}
                        onClick={() => tabs.switchTab(tab)}
                    />
                ))}
                {tabs.active.found && (
                    <Tab
                        label={tabs.active.value.title}
                        active={true}
                        key={tabs.active.value.id}
                        onClose={() => tabs.closeTab(unsafeDefinitely(tabs.active).id)}
                    />
                )}
                {tabs.right.map((tab) => (
                    <Tab
                        label={tab.title}
                        active={false}
                        key={tab.id}
                        onClose={() => tabs.closeTab(tab.id)}
                        onClick={() => tabs.switchTab(tab)}
                    />
                ))}
                <AddButton onClick={(_) => tabs.addTab()}>+</AddButton>
            </TabHeader>
            <TabContent>
                {tabs.active.found ? (
                    tabs.active.value.path.found ? (
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
