import React from 'react';

interface Props {
    data: any;
    indent?: number;
}

export const JsonViewer: React.FC<Props> = ({ data, indent = 0 }) => {
    if (data === null) return <span className="json-null">null</span>;
    if (typeof data === 'boolean') return <span className="json-boolean">{data.toString()}</span>;
    if (typeof data === 'number') return <span className="json-number">{data}</span>;
    if (typeof data === 'string') {
        if (data.length > 300) {
            return <span className="json-string">"{data.substring(0, 300)}..."</span>;
        }
        return <span className="json-string">"{data}"</span>;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return <span>[]</span>;
        return (
            <span>
                [<br />
                {data.map((item, i) => (
                    <React.Fragment key={i}>
                        <span style={{ paddingLeft: `${(indent + 1) * 16}px` }}>
                            <JsonViewer data={item} indent={indent + 1} />
                            {i < data.length - 1 ? ',' : ''}
                            <br />
                        </span>
                    </React.Fragment>
                ))}
                <span style={{ paddingLeft: `${indent * 16}px` }}>]</span>
            </span>
        );
    }

    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return <span>{`{}`}</span>;

        return (
            <span>
                {'{'}<br />
                {keys.map((k, i) => (
                    <React.Fragment key={k}>
                        <span style={{ paddingLeft: `${(indent + 1) * 16}px` }}>
                            <span className="json-key">"{k}"</span>: <JsonViewer data={data[k]} indent={indent + 1} />
                            {i < keys.length - 1 ? ',' : ''}
                            <br />
                        </span>
                    </React.Fragment>
                ))}
                <span style={{ paddingLeft: `${indent * 16}px` }}>{'}'}</span>
            </span>
        );
    }

    return <span>{String(data)}</span>;
};
