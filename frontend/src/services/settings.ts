import axiosInstance from './api';

interface SettingResponse {
  key: string;
  value: string;
  isMasked: boolean;
  lastTestedAt?: string;
  updatedAt: string;
}

interface CreateSettingRequest {
  key: string;
  value: string;
  reason?: string;
}

interface UpdateSettingRequest {
  value: string;
  lastTestedAt?: string;
  reason?: string;
}

const settingsService = {
  async getAllSettings(masked: boolean = true): Promise<SettingResponse[]> {
    const response = await axiosInstance.get('/settings', {
      params: { masked: masked ? 'true' : 'false' },
    });
    return response.data;
  },

  async getSetting(key: string, masked: boolean = true): Promise<SettingResponse> {
    const response = await axiosInstance.get(`/settings/${key}`, {
      params: { masked: masked ? 'true' : 'false' },
    });
    return response.data;
  },

  async createSetting(dto: CreateSettingRequest): Promise<SettingResponse> {
    const response = await axiosInstance.post('/settings', dto);
    return response.data;
  },

  async updateSetting(key: string, dto: UpdateSettingRequest): Promise<SettingResponse> {
    const response = await axiosInstance.put(`/settings/${key}`, dto);
    return response.data;
  },

  async getSettingUnmasked(key: string): Promise<string> {
    try {
      const response = await axiosInstance.get(`/settings/${key}`, {
        params: { masked: 'false' },
      });
      return response.data.value;
    } catch (error) {
      console.error(`Failed to get unmasked setting ${key}:`, error);
      throw error;
    }
  },

  async uploadLogo(file: File): Promise<{ fileName: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post('/settings/logo/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async testSetting(key: string): Promise<{ success: boolean; message: string; lastTestedAt: string }> {
    const response = await axiosInstance.post(`/settings/${key}/test`);
    return response.data;
  },

  async getAuditLog(key: string): Promise<any[]> {
    const response = await axiosInstance.get(`/settings/${key}/audit-log`);
    return response.data;
  },
};

export default settingsService;
