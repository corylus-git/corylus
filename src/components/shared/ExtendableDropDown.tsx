import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { StyledInput } from '../util/StyledInput';

export interface ExtendableDropDownProps {
    /**
     * The options available in the drop down
     */
    options: string[];
    /**
     * The selected value
     *
     * This is NOT necessarily part of the available drop down options
     */
    value: string;
    /**
     * callback fired when the user changes the value of the field
     */
    onChange?: (value: string) => void;
}

const ElementContainer = styled.div`
    position: relative;
    display: flex;
`;

const DropDownList = styled.ul`
    position: absolute;
    top: 100%;
    background-color: var(--background);
    border: 1px solid var(--border);
    margin-top: 0;
    list-style: none;
    min-width: 100%;
    padding: 0.25rem;
    box-sizing: border-box;

    li:hover {
        background-color: var(--highlight);
    }
`;

export const ExtendableDropDown: React.FC<ExtendableDropDownProps> = (props) => {
    const [open, setOpen] = React.useState(false);
    return (
        <ElementContainer>
            <StyledInput
                type="text"
                onChange={(ev) => props.onChange?.(ev.target.value)}
                value={props.value}
            />
            <StyledButton
                onClick={(ev) => {
                    setOpen(!open);
                    ev.preventDefault();
                }}>
                ▼
            </StyledButton>
            {open && (
                <DropDownList>
                    {props.options.map((o) => (
                        <li
                            key={o}
                            onClick={(_) => {
                                props.onChange?.(o);
                                setOpen(false);
                            }}>
                            {o}
                        </li>
                    ))}
                </DropDownList>
            )}
        </ElementContainer>
    );
};
