import * as React from 'react';
import { BranchInfo, Commit, Tag } from '../../../model/stateObjects';
import { BranchDisplay } from './BranchDisplay';
import { TagDisplay } from './TagDisplay';
import styled from 'styled-components';

export interface CommitInfoProps {
    commit: Commit;
    branches: readonly BranchInfo[];
    tags: readonly Tag[];
    rail: number;
    onCommitSelect: (commit: Commit) => void;
    searchTerm?: string;
}

const SearchTerm = styled.span`
    background-color: yellow;
    color: black;
`;

const Highlighter: React.FC<{ str: string; searchTerm?: string }> = (props) => {
    const parts =
        (props.searchTerm && [...props.str.split(new RegExp(`(${props.searchTerm})`, 'gi'))]) || [];
    if (parts.length === 0) {
        return <>{props.str}</>;
    }
    return (
        <>
            {parts.map((part, index) =>
                index % 2 === 0 ? (
                    <React.Fragment key={index}>{part}</React.Fragment>
                ) : (
                    <SearchTerm key={index}>{part}</SearchTerm>
                )
            )}
        </>
    );
};

function CommitMessage(props: { message: string; searchTerm?: string }) {
    return (
        <pre style={{ margin: 0, padding: 0, fontFamily: 'inherit', display: 'inline' }}>
            <Highlighter str={props.message} searchTerm={props.searchTerm} />
        </pre>
    );
}

const Oid = styled.span`
    font-size: 90%;
    font-style: italic;
    margin-right: 1rem;
`;

export const CommitInfo: React.FC<CommitInfoProps> = (props) => {
    return (
        <div
            style={{
                height: '3rem',
                borderBottom: '1px dotted rgba(255,255,255,0.1)',
                padding: '5px',
                boxSizing: 'border-box',
                cursor: 'pointer',
            }}
            onClick={() => props.onCommitSelect(props.commit)}>
            <div
                style={{
                    height: '1.2rem',
                    overflow: 'hidden',
                    margin: 0,
                    whiteSpace: 'nowrap',
                }}>
                <Oid>
                    <Highlighter str={props.commit.short_oid} searchTerm={props.searchTerm} />:
                </Oid>{' '}
                <CommitMessage
                    message={props.commit.message.split('\n', 2)[0]}
                    searchTerm={props.searchTerm}
                />
            </div>
            <p
                style={{
                    height: '1rem',
                    overflow: 'hidden',
                    margin: 0,
                    marginTop: '0.1rem',
                    marginLeft: '0.5rem',
                    fontSize: '80%',
                }}>
                {props.branches
                    .filter((b) => b.head === props.commit.oid && !b.isDetached)
                    .map((b) => (
                        <BranchDisplay
                            key={`b-${b.remote}-${b.ref}`}
                            branch={b}
                            rail={props.rail}
                        />
                    ))}
                {props.tags
                    .filter((t) => t.taggedOid === props.commit.oid)
                    .map((t) => (
                        <TagDisplay key={`t-${t.name}`} tag={t} rail={props.rail} />
                    ))}
                <Highlighter str={props.commit.author.name} searchTerm={props.searchTerm} /> on{' '}
                {props.commit.author.timestamp.toLocaleString()}{' '}
            </p>
        </div>
    );
};
