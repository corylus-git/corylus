import React from 'react';

export function structuredToast(title: string, content: string[]) {
    return (
        <>
            <h2>{title}</h2>
            <div>
                {content.map((paragraph, index) => (
                    <>
                        <span key={index}>{paragraph}</span>
                        <br />
                    </>
                ))}
            </div>
        </>
    );
}
