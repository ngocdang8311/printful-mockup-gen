import axios, { AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import { config } from '../config.js';

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 200,
});

function getApi(): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.printify.com/v1',
    headers: {
      Authorization: `Bearer ${config.printifyToken}`,
      'User-Agent': 'PrintifyMockupTool/1.0',
    },
    timeout: 60000,
  });
}

async function request<T>(fn: (api: AxiosInstance) => Promise<T>): Promise<T> {
  return limiter.schedule(() => fn(getApi()));
}

// Shops
export async function getShops() {
  return request(async (api) => {
    const { data } = await api.get('/shops.json');
    return data;
  });
}

// Blueprints (catalog)
export async function getBlueprints() {
  return request(async (api) => {
    const { data } = await api.get('/catalog/blueprints.json');
    return data;
  });
}

export async function getBlueprint(blueprintId: number) {
  return request(async (api) => {
    const { data } = await api.get(`/catalog/blueprints/${blueprintId}.json`);
    return data;
  });
}

export async function getBlueprintProviders(blueprintId: number) {
  return request(async (api) => {
    const { data } = await api.get(`/catalog/blueprints/${blueprintId}/print_providers.json`);
    return data;
  });
}

export async function getBlueprintVariants(blueprintId: number, providerId: number) {
  return request(async (api) => {
    const { data } = await api.get(
      `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`
    );
    return data;
  });
}

export async function getProviderShipping(blueprintId: number, providerId: number) {
  return request(async (api) => {
    const { data } = await api.get(
      `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/shipping.json`
    );
    return data;
  });
}

// Image upload
export async function uploadImage(fileName: string, base64Contents: string) {
  return request(async (api) => {
    const { data } = await api.post('/uploads/images.json', {
      file_name: fileName,
      contents: base64Contents,
    });
    return data;
  });
}

// Products (for mockup generation workaround)
export async function createProduct(shopId: string, product: any) {
  return request(async (api) => {
    console.log(`[Printify] Creating product on shop ${shopId}:`, product.title);
    const { data } = await api.post(`/shops/${shopId}/products.json`, product);
    return data;
  });
}

export async function getProduct(shopId: string, productId: string) {
  return request(async (api) => {
    const { data } = await api.get(`/shops/${shopId}/products/${productId}.json`);
    return data;
  });
}

export async function deleteProduct(shopId: string, productId: string) {
  return request(async (api) => {
    await api.delete(`/shops/${shopId}/products/${productId}.json`);
    console.log(`[Printify] Deleted product ${productId}`);
  });
}

export const printifyClient = {
  getShops,
  getBlueprints,
  getBlueprint,
  getBlueprintProviders,
  getBlueprintVariants,
  getProviderShipping,
  uploadImage,
  createProduct,
  getProduct,
  deleteProduct,
};
