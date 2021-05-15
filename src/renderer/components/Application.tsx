import { hot } from 'react-hot-loader/root';
import React, { useState, useEffect } from 'react';
import 'react-toastify/dist/ReactToastify.min.css';
import { basename } from 'path';
import { HashRouter as Router } from 'react-router-dom';

import '../../style/app.css';
import styled, { ThemeProvider, DefaultTheme } from 'styled-components';
import { Tabs } from './util/Tabs';
import { Logger } from '../../util/logger';
import { appSettings } from '../../model/settings';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';
import { AboutPanel } from './AboutPanel';
import { ipcRenderer } from 'electron';
import { ToastContainer } from 'react-toastify';
import { QueryClient, QueryClientProvider } from 'react-query';

import { nanoid } from 'nanoid';
import { just } from '../../util/maybe';
import { useTabs } from '../../model/state/tabs';
import { useTheme } from '../../model/state/theme';

const ApplicationView = styled.div`
    height: 100%;
    width: 100%;
    background-color: var(--background);
    color: var(--foreground);
`;

const Application = () => {
    const [showAbout, setShowAbout] = useState(false);
    const theme = useTheme();
    const tabs = useTabs();

    const queryClient = new QueryClient();

    useEffect(() => {
        tabs.loadTabs(
            appSettings.openTabs.map((t) => ({
                id: nanoid(),
                path: just(t),
                title: basename(t),
            }))
        );
        theme.switchTheme(appSettings.theme);
    }, []);
    Logger().debug('Application', 'Re-rendering <Application />', { theme: theme.current });
    React.useEffect(() => {
        ipcRenderer.on('show-about', (_) => {
            setShowAbout(true);
        });
    }, []);
    React.useEffect(() => {
        document.documentElement.style.setProperty('--hue', theme.current.hue.toString());
        document.documentElement.style.setProperty('--lightness', theme.current.lightness);
    }, [theme.current]);
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme.current}>
                <ApplicationView>
                    <GlobalErrorBoundary>
                        <Router>
                            <Tabs />
                            <AboutPanel open={showAbout} onClose={() => setShowAbout(false)} />
                        </Router>
                        <ToastContainer
                            newestOnTop={false}
                            position="bottom-right"
                            style={{ width: '40rem' }}
                            closeButton={false}
                        />
                    </GlobalErrorBoundary>
                </ApplicationView>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

export default hot(Application);
