import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { ProjectStatus, ProjectStatusResponse } from '../lib/types';

export function useProjectStatus(projectId: string) {
    const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.PENDING);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ProjectStatusResponse | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;

        const poll = async () => {
            try {
                const res = await api.get<ProjectStatusResponse>(`/projects/${projectId}/status`);
                if (!isMounted) return;

                const newStatus = res.data.status;
                setStatus(newStatus);
                setData(res.data);
                setError(res.data.error);

                // Stop polling if completed or failed
                if (newStatus === ProjectStatus.READY || newStatus === ProjectStatus.FAILED) {
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error("Polling error", err);
                // Don't set error state immediately on transient net errors to avoid UI flicker
            }
        };

        // Initial fetch
        poll();

        // Start polling
        pollRef.current = setInterval(poll, 2000);

        return () => {
            isMounted = false;
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [projectId]);

    return { status, error, data };
}
