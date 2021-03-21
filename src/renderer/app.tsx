import domain from 'domain';
import React from 'react';
import ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';

import '../style/app.css';

import Application from './components/Application';
import { initLogging, Logger, LogBuffer } from '../util/logger';
import { ipcRenderer } from 'electron';
import { toast } from 'react-toastify';
import { startAppSettingsStorage } from '../model/settings';

let level: 'info' | 'debug' | 'silly' = 'info';
if (process.env.NODE_ENV !== 'production') {
    level = 'debug';
}
if (process.env.DEBUG !== undefined) {
    level = process.env.DEBUG === 'debug' ? 'debug' : 'silly';
}

// configure logging
if (level === 'debug' || level === 'silly' || process.env.NODE_ENV !== 'production') {
    initLogging(level, process.env.NODE_ENV === 'production');
} else {
    initLogging(level, process.env.GITCLIENT_STDOUT !== undefined);
}

// Create main element
const mainElement = document.createElement('div');
mainElement.className = 'main';
document.body.appendChild(mainElement);

ipcRenderer.on('toast-from-main', (ev, args) => {
    toast(args[0].message, args[0].options);
});

// store the error log
function saveLog() {
    Logger().debug('saveLog', 'Requesting log file save');
    ipcRenderer.send('save-log', JSON.stringify(LogBuffer().getBuffer()));
}

// Render components
const render = (Component: () => JSX.Element) => {
    window.addEventListener(
        'keyup',
        (ev) =>
            (async () => {
                if (ev.shiftKey && ev.ctrlKey && ev.key === 'L') await saveLog();
            })(),
        true
    );
    startAppSettingsStorage();

    ReactDOM.render(
        <AppContainer>
            <Component />
        </AppContainer>,
        mainElement
    );
};

const d = domain.create();
d.on('error', (err) => {
    Logger().emerg('app', 'An unrecoverable error occured in the application. Exiting.', {
        error: err,
    });
    process.exit(1);
});

d.run(() => {
    render(Application);
});
