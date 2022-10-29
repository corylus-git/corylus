import React, { Children, useEffect } from "react";

export const AsyncValue: React.FC<{children: Promise<any>}> = (props) => {
    const [value, setValue] = React.useState();
    useEffect(() => {
        props.children.then(v => setValue(v));
    }, [props.children]);
    return <>{value}</>
}