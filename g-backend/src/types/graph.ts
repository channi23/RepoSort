export interface GraphHints {
    nodes: Array<{
        path: string;
        type: string;
        label: string;
    }>;
    edges: Array<{
        from: string;
        to: string;
        type: string;
    }>;
}
