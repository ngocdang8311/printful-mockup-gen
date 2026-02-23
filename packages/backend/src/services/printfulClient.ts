import axios, { AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import { config } from '../config.js';

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 200, // 5 requests per second max
});

function getApi(): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
      Authorization: `Bearer ${config.printfulToken}`,
    },
    timeout: 30000,
  });
}

async function request<T>(fn: (api: AxiosInstance) => Promise<T>): Promise<T> {
  return limiter.schedule(() => fn(getApi()));
}

// Catalog
export async function getProducts() {
  return request(async (api) => {
    const { data } = await api.get('/products');
    return data.result;
  });
}

export async function getProduct(productId: number) {
  return request(async (api) => {
    const { data } = await api.get(`/products/${productId}`);
    return data.result;
  });
}

export async function getProductPrintfiles(productId: number) {
  return request(async (api) => {
    const { data } = await api.get(`/mockup-generator/printfiles/${productId}`);
    return data.result;
  });
}

export async function getProductTemplates(productId: number) {
  return request(async (api) => {
    const { data } = await api.get(`/mockup-generator/templates/${productId}`);
    return data.result;
  });
}

// Mockup Generation
export interface CreateTaskRequest {
  variant_ids: number[];
  format: string;
  files: Array<{
    placement: string;
    image_url: string;
    position?: {
      area_width: number;
      area_height: number;
      width: number;
      height: number;
      top: number;
      left: number;
    };
  }>;
  option_groups?: string[];
  options?: string[];
}

export async function createMockupTask(productId: number, body: CreateTaskRequest) {
  return request(async (api) => {
    const { data } = await api.post(`/mockup-generator/create-task/${productId}`, body);
    return data.result;
  });
}

export async function getMockupTaskResult(taskKey: string) {
  return request(async (api) => {
    const { data } = await api.get(`/mockup-generator/task`, {
      params: { task_key: taskKey },
    });
    return data.result;
  });
}

export const printfulClient = {
  getProducts,
  getProduct,
  getProductPrintfiles,
  getProductTemplates,
  createMockupTask,
  getMockupTaskResult,
};
