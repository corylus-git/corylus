import React from 'react';
import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { StyledButton } from '../util/StyledButton';
import styled from 'styled-components';
import { useTabs } from '../../model/state/tabs';
import { toast } from 'react-toastify';
import { Logger } from '../../util/logger';
import { structuredToast } from '../../util/structuredToast';
import { HistoryEntry } from '../../model/settings';

const HistoryEntryButton = styled(StyledButton)`
    display: block;
    font-size: 1.1rem;
    margin: 0.25rem;
    padding: 0.25rem;
    width: 100%;
`;

interface HistoryBlockComponentProps {
    title: string;
    block: HistoryEntry[];
}

const HistoryBlock: React.FC<HistoryBlockComponentProps> = (props) => {
    const tabs = useTabs();
    if (props.block.length === 0) {
        return <></>;
    }
    return (
        <>
            <h2>{props.title}</h2>
            {props.block.map((e) => (
                <HistoryEntryButton
                    key={e.path}
                    onClick={() => {
                        try {
                            tabs.openRepoInActive(e.path);
                        } catch (e: any) {
                            Logger().error(
                                'RepositoryHistory',
                                'Could not open repository from history',
                                { error: e }
                            );
                            if (e instanceof Error)
                            {
                                toast.error(
                                    structuredToast(
                                        'Could not open repository',
                                        e.toString().split('\n')
                                    ),
                                    { autoClose: false }
                                );
                            }
                        }
                    }}
                    title={e.path}>
                    <>{e.title} - {e.date.toLocaleDateString()}</>
                </HistoryEntryButton>
            ))}
        </>
    );
};

export const RepositoryHistory: React.FC<{ history: HistoryEntry[]; alreadyOpen: string[] }> = (
    props
) => {
    const groupedHistory = React.useMemo(() => {
        const h = Array.from(props.history).filter(
            (entry) => !props.alreadyOpen.find((c) => c === entry.path)
        );
        return {
            today: h.filter((entry) => isToday(entry.date)),
            yesterday: h
                .filter((entry) => isYesterday(entry.date)),
            thisWeek: h
                .filter((entry) => isThisWeek(entry.date) && !isToday(entry.date) && !isYesterday(entry.date)),
            thisMonth: h
                .filter(
                    (entry) =>
                        isThisMonth(entry.date) &&
                        !isThisWeek(entry.date) &&
                        !isToday(entry.date) &&
                        !isYesterday(entry.date)
                ),
            older: h
                .filter(
                    (entry) =>
                        !isThisMonth(entry.date) &&
                        !isThisWeek(entry.date) &&
                        !isToday(entry.date) &&
                        !isYesterday(entry.date)
                ),
        };
    }, [props.history]);
    return (
        <div>
            <h1>Recently opened repositories</h1>
            <HistoryBlock title="Today" block={groupedHistory.today} />
            <HistoryBlock title="Yesterday" block={groupedHistory.yesterday} />
            <HistoryBlock title="This week" block={groupedHistory.thisWeek} />
            <HistoryBlock title="This month" block={groupedHistory.thisMonth} />
            <HistoryBlock title="Older" block={groupedHistory.older} />
        </div>
    );
};
