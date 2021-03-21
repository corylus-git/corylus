import React from 'react';
import { Logger } from '../../util/logger';

export class GlobalErrorBoundary extends React.Component<
    React.PropsWithChildren<any>,
    { error: boolean }
> {
    constructor(props: React.PropsWithChildren<any>) {
        super(props);
        this.state = { error: false };
    }

    static getDerivedStateFromError(_: Error): { error: boolean } {
        return { error: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        Logger().error('GlobalErrorBoundary', 'Caught unrecoverable error.', {
            error: error.toString(),
            info: errorInfo,
        });
    }

    render(): React.ReactNode {
        if (this.state.error) {
            return (
                <>
                    <h1>Unhandled error</h1>
                    <p>Sorry, an unhandled error occured somewhere in the application.</p>
                    <p>To save a log file, press Ctrl+Shift+L.</p>
                </>
            );
        }
        return this.props.children;
    }
}
