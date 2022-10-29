export type TimestampProps = {
    timestamp: { utc_seconds: number, offset_seconds: number }
}

export const Timestamp: React.FC<TimestampProps> = (props) => {
    const date = new Date(props.timestamp.utc_seconds*1000 + props.timestamp.utc_seconds*1000);
    return <>{date.toLocaleString()}</>
}