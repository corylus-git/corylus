import React, { useEffect } from 'react';
import { StyledDialog } from '../util/StyledDialog';
import styled from 'styled-components';
import { Logger } from '../../util/logger';
import { StyledInput } from '../util/StyledInput';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';

const SearchBoxContainer = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    z-index: 100;
`;

export interface SearchBoxProps {
    onTermChange: (term: string) => void;
    onNext?: () => void;
    onPrevious?: () => void;
    isFirst: boolean;
    isLast: boolean;
}

export const SearchBox: React.FC<SearchBoxProps> = (props) => {
    const [open, setOpen] = React.useState(false);

    const searchBoxToggle = (ev: KeyboardEvent) => {
        if (ev.ctrlKey && ev.key === 'f') {
            Logger().silly('SearchBox', 'Toggle search box', { open: !open });
            setOpen(!open);
        }
        if (ev.key === 'Escape') {
            setOpen(false);
            props.onTermChange(''); // reset the search term to undo all matches
        }
    };

    useEffect(() => {
        Logger().silly('SearchBox', 'Registering hot-key event handler');
        window.addEventListener('keyup', searchBoxToggle);
        return () => window.removeEventListener('keyup', searchBoxToggle);
    }, [open]);

    return (
        <SearchBoxContainer>
            {open && (
                <StyledDialog>
                    <StyledInput
                        placeholder="Search..."
                        autoFocus
                        onChange={(ev) => props.onTermChange(ev.currentTarget.value)}
                    />
                    <ButtonGroup>
                        <StyledButton
                            title="Go to previous match"
                            disabled={props.isFirst}
                            onClick={props.onPrevious}>
                            &lt;
                        </StyledButton>
                        <StyledButton
                            title="Go to next match"
                            disabled={props.isLast}
                            onClick={props.onNext}>
                            &gt;
                        </StyledButton>
                    </ButtonGroup>
                </StyledDialog>
            )}
        </SearchBoxContainer>
    );
};
