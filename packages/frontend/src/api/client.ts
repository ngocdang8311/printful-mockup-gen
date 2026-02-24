import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Presets
export const getPresets = () => api.get('/presets').then(r => r.data);
export const getPreset = (id: number) => api.get(`/presets/${id}`).then(r => r.data);
export const createPreset = (data: { name: string; description?: string; provider?: string }) =>
  api.post('/presets', data).then(r => r.data);
export const updatePreset = (id: number, data: { name: string; description?: string }) =>
  api.put(`/presets/${id}`, data).then(r => r.data);
export const deletePreset = (id: number) => api.delete(`/presets/${id}`).then(r => r.data);
export const addPresetItem = (presetId: number, data: any) =>
  api.post(`/presets/${presetId}/items`, data).then(r => r.data);
export const updatePresetItem = (presetId: number, itemId: number, data: any) =>
  api.put(`/presets/${presetId}/items/${itemId}`, data).then(r => r.data);
export const clonePreset = (id: number) => api.post(`/presets/${id}/clone`).then(r => r.data);
export const deletePresetItem = (presetId: number, itemId: number) =>
  api.delete(`/presets/${presetId}/items/${itemId}`).then(r => r.data);

// Designs
export const getDesigns = () => api.get('/designs').then(r => r.data);
export const uploadDesign = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/designs', form).then(r => r.data);
};
export const deleteDesign = (id: number) => api.delete(`/designs/${id}`).then(r => r.data);
export const checkDesignUrl = (id: number) => api.get(`/designs/${id}/check-url`).then(r => r.data);

// Catalog
export const getCatalogProducts = () => api.get('/catalog/products').then(r => r.data);
export const getCatalogProduct = (id: number) => api.get(`/catalog/products/${id}`).then(r => r.data);
export const getProductPrintfiles = (id: number) => api.get(`/catalog/products/${id}/printfiles`).then(r => r.data);
export const getProductTemplates = (id: number) => api.get(`/catalog/products/${id}/templates`).then(r => r.data);
export const getProductPlacements = (id: number) => api.get(`/catalog/products/${id}/placements`).then(r => r.data);

// Generation
export const startGeneration = (data: {
  presetId: number;
  designId: number;
  designMap?: Record<string, number>;
}) => api.post('/generate', data).then(r => r.data);
export const getJob = (id: number) => api.get(`/generate/${id}`).then(r => r.data);
export const cancelJob = (id: number) => api.post(`/generate/${id}/cancel`).then(r => r.data);
export const getJobs = () => api.get('/jobs').then(r => r.data);
export const getJobOutputs = (jobId: number) => api.get(`/jobs/${jobId}/outputs`).then(r => r.data);

// Printify Catalog
export const getPrintifyShops = () => api.get('/printify/shops').then(r => r.data);
export const getPrintifyBlueprints = () => api.get('/printify/blueprints').then(r => r.data);
export const getPrintifyBlueprint = (id: number) => api.get(`/printify/blueprints/${id}`).then(r => r.data);
export const getPrintifyBlueprintProviders = (id: number) => api.get(`/printify/blueprints/${id}/providers`).then(r => r.data);
export const getPrintifyBlueprintVariants = (blueprintId: number, providerId: number) =>
  api.get(`/printify/blueprints/${blueprintId}/providers/${providerId}/variants`).then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data: {
  printfulToken?: string;
  printifyToken?: string;
  printifyShopId?: string;
  publicUrl?: string;
}) => api.put('/settings', data).then(r => r.data);
export const testConnection = () => api.get('/settings/test-connection').then(r => r.data);
export const testPrintifyConnection = () => api.get('/settings/test-printify').then(r => r.data);

// SSE helper
export function subscribeToJob(jobId: number, onMessage: (data: any) => void): () => void {
  const eventSource = new EventSource(`/api/generate/${jobId}/events`);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch { /* ignore parse errors */ }
  };
  return () => eventSource.close();
}
