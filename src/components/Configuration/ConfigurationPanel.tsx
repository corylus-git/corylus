import React from 'react';
import styled from 'styled-components';
import { Logger } from '../../util/logger';
import { StyledInput } from '../util/StyledInput';
import { Formik } from 'formik';
import { ConfigSection } from './ConfigSection';
import { useTheme, allThemes } from '../../model/state/theme';
import { StyledButton } from '../util/StyledButton';
import { useConfig } from '../../model/state/repo';

const ConfigPanelContainer = styled.div`
    width: 100%;
    height: 100%;
`;

export const ConfigurationPanel: React.FC = () => {
    const {data: gitConfig} = useConfig();
    const theme = useTheme();
    return (
        !gitConfig ? <div>Loading config...</div> : 
        <ConfigPanelContainer>
            <Formik
                initialValues={{
                    username: gitConfig?.user?.name.value ?? '',
                    useremail: gitConfig?.user?.email.value ?? '',
                    autoFetchEnabled: !!gitConfig?.corylus?.autoFetchEnabled,
                    autoFetchInterval: gitConfig?.corylus?.autoFetchInterval ?? 5,
                }}
                onSubmit={(values) => {}
                }
                enableReinitialize>
                {(formik) => (
                    <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
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
                        <ConfigSection title="Remotes">
                            <label htmlFor="autoFetchEnabled">
                                Automatically fetch remote repositories
                            </label>
                            <input
                                type="checkbox"
                                id="autoFetchEnabled"
                                checked={formik.values.autoFetchEnabled}
                                {...formik.getFieldProps('autoFetchEnabled')}
                            />
                            <label htmlFor="autoFetchInterval">Fetch interval</label>
                            <div>
                                <input
                                    type="number"
                                    id="autoFetchInterval"
                                    {...formik.getFieldProps('autoFetchInterval')}
                                    disabled={!formik.values.autoFetchEnabled}
                                />{' '}
                                minutes
                            </div>
                        </ConfigSection>
                        <StyledButton type="submit">Save</StyledButton>
                    </form>
                )}
            </Formik>
        </ConfigPanelContainer>
    );
};
