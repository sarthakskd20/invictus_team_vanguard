import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    register: (data) => api.post('/auth/register', data),
    getProfile: () => api.get('/auth/profile')
};

// Components (Inventory)
export const componentAPI = {
    getAll: (params) => api.get('/components', { params }),
    getById: (id) => api.get(`/components/${id}`),
    create: (data) => api.post('/components', data),
    update: (id, data) => api.put(`/components/${id}`, data),
    delete: (id) => api.delete(`/components/${id}`),
    import: (formData) => api.post('/components/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    export: () => api.get('/components/export', { responseType: 'blob' }),
    getCategories: () => api.get('/components/categories')
};

// PCB Types
export const pcbAPI = {
    getAll: () => api.get('/pcb-types'),
    getById: (id) => api.get(`/pcb-types/${id}`),
    getBom: (id) => api.get(`/pcb-types/${id}/bom`),
    create: (data) => api.post('/pcb-types', data),
    update: (id, data) => api.put(`/pcb-types/${id}`, data),
    delete: (id) => api.delete(`/pcb-types/${id}`)
};

// Production
export const productionAPI = {
    createEntry: (data) => api.post('/production/entry', data),
    getHistory: (params) => api.get('/production/history', { params }),
    getDetail: (id) => api.get(`/production/${id}`)
};

// Dashboard
export const dashboardAPI = {
    getSummary: () => api.get('/dashboard/summary'),
    getTopConsumed: (limit) => api.get('/dashboard/top-consumed', { params: { limit } }),
    getLowStock: () => api.get('/dashboard/low-stock'),
    getConsumptionTrend: (days) => api.get('/dashboard/consumption-trend', { params: { days } }),
    getProductionByPCB: () => api.get('/dashboard/production-by-pcb'),
    getStockByCategory: () => api.get('/dashboard/stock-by-category')
};

// Procurement
export const procurementAPI = {
    getAll: (status) => api.get('/procurement', { params: { status } }),
    acknowledge: (id) => api.put(`/procurement/${id}/acknowledge`),
    resolve: (id) => api.put(`/procurement/${id}/resolve`)
};

// Reports
export const reportAPI = {
    exportInventory: () => api.get('/reports/inventory-export', { responseType: 'blob' }),
    exportConsumption: (params) => api.get('/reports/consumption-export', { params, responseType: 'blob' }),
    getTransactionHistory: (componentId) => api.get(`/reports/transaction-history/${componentId}`)
};

export default api;
