import React from 'react';
import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { StyledButton } from '../util/StyledButton';
import styled from 'styled-components';
import { basename } from '@tauri-apps/api/path';
import { useTabs } from '../../model/state/tabs';
import { toast } from 'react-toastify';
import { Logger } from '../../util/logger';
import { structuredToast } from '../../util/structuredToast';

const HistoryEntryButton = styled(StyledButton)`
    display: block;
    font-size: 1.1rem;
    margin: 0.25rem;
    padding: 0.25rem;
    width: 100%;
`;

interface HistoryBlockComponentProps {
    title: string;
    block: { path: string; date: Date }[];
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
                    {basename(e.path)} - {e.date.toLocaleDateString()}
                </HistoryEntryButton>
            ))}
        </>
    );
};

export const RepositoryHistory: React.FC<{ history: Map<string, Date>; alreadyOpen: string[] }> = (
    props
) => {
    const groupedHistory = React.useMemo(() => {
        const h = Array.from(props.history.entries()).filter(
            ([path, _]) => !props.alreadyOpen.find((c) => c === path)
        );
        return {
            today: h.filter(([_, date]) => isToday(date)).map(([path, date]) => ({ path, date })),
            yesterday: h
                .filter(([_, date]) => isYesterday(date))
                .map(([path, date]) => ({ path, date })),
            thisWeek: h
                .filter(([_, date]) => isThisWeek(date) && !isToday(date) && !isYesterday(date))
                .map(([path, date]) => ({ path, date })),
            thisMonth: h
                .filter(
                    ([_, date]) =>
                        isThisMonth(date) &&
                        !isThisWeek(date) &&
                        !isToday(date) &&
                        !isYesterday(date)
                )
                .map(([path, date]) => ({ path, date })),
            older: h
                .filter(
                    ([_, date]) =>
                        !isThisMonth(date) &&
                        !isThisWeek(date) &&
                        !isToday(date) &&
                        !isYesterday(date)
                )
                .map(([path, date]) => ({ path, date })),
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
