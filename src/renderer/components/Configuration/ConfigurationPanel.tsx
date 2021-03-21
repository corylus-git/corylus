import React from 'react';
import styled from 'styled-components';
import { Logger } from '../../../util/logger';
import { StyledInput } from '../util/StyledInput';
import { Formik } from 'formik';
import { effective } from '../../../model/IGitConfig';
import { ConfigSection } from './ConfigSection';
import { darkTheme } from '../../../style/dark-theme';
import { useTheme, allThemes } from '../../../model/state/theme';
import { useConfig } from '../../../model/state/repo';

const ConfigPanelContainer = styled.div`
    width: 100%;
    height: 100%;
`;

export const ConfigurationPanel: React.FC = () => {
    const gitConfig = useConfig();
    const theme = useTheme();
    return (
        <ConfigPanelContainer>
            <Formik
                initialValues={{
                    username: effective(gitConfig)?.user?.name,
                    useremail: effective(gitConfig)?.user?.email,
                }}
                onSubmit={() => {}}
                enableReinitialize>
                {(formik) => (
                    <>
                        <ConfigSection title="User">
                            <label htmlFor="username">Name:</label>
                            <StyledInput
                                placeholder="User name"
                                id="username"
                                {...formik.getFieldProps('username')}
                            />
                            <label htmlFor="useremail">Email address:</label>
                            <StyledInput
                                placeholder="Email address"
                                id="useremail"
                                {...formik.getFieldProps('useremail')}
                            />
                        </ConfigSection>
                        <ConfigSection title="Appearance">
                            <label htmlFor="theme">Theme:</label>
                            <select
                                id="theme"
                                value={theme.current.name}
                                onChange={(value) => {
                                    Logger().debug(
                                        'ConfigurationPanel',
                                        'Changing application theme',
                                        { theme: value.currentTarget.value }
                                    );
                                    theme.switchTheme(value.currentTarget.value);
                                }}>
                                {allThemes.map((t) => (
                                    <option key={t.name} value={t.name}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </ConfigSection>
                    </>
                )}
            </Formik>
        </ConfigPanelContainer>
    );
};
