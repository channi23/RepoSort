import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // Add trace ID for debugging
    config.headers['x-trace-id'] = `trace-${Date.now()}`;
    return config;
});

export const nodeActions = {
    create: (data: any) => api.post('/node-actions/refactor', data), // Defaulting to refactor endpoint, controller handles types or we map them
    // Actually the controller has separate endpoints. Let's make it generic or separate.
    // Let's use specific endpoints matching controller
    refactor: (data: any) => api.post('/node-actions/refactor', data),
    harden: (data: any) => api.post('/node-actions/harden', data),
    addTests: (data: any) => api.post('/node-actions/add-tests', data),
    optimize: (data: any) => api.post('/node-actions/optimize', data),
    rename: (data: any) => api.post('/node-actions/rename', data),

    get: (id: string) => api.get(`/node-actions/${id}`),
    execute: (id: string) => api.post(`/node-actions/${id}/execute`),
};

export default api;
