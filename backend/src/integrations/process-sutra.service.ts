import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

export interface StartFlowPayload {
  system: string;
  orderNumber: string;
  description: string;
  initialFormData: Record<string, any>;
  notifyAssignee?: boolean;
}

export interface StartFlowResponse {
  success: boolean;
  message?: string;
  flowId?: string;
  data?: any;
}

@Injectable()
export class ProcessSutraService {
  private readonly logger = new Logger(ProcessSutraService.name);
  private readonly apiUrl = 'https://processsutra.com/api/integrations/start-flow';

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {}

  async startFlow(
    apiKey: string,
    systemName: string,
    payload: StartFlowPayload,
    actorEmail: string = 'crm-system',
  ): Promise<StartFlowResponse> {
    if (!apiKey) throw new BadRequestException('Process Sutra API Key not configured');
    if (!systemName) throw new BadRequestException('Process Sutra System Name not configured');

    const body = {
      system: systemName,
      orderNumber: payload.orderNumber || '',
      description: payload.description || '',
      initialFormData: payload.initialFormData || {},
      notifyAssignee: payload.notifyAssignee !== false,
    };

    this.logger.log(`Starting Process Sutra flow for system: ${systemName}`);

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.http.post(this.apiUrl, body, {
          headers: {
            'x-api-key': apiKey,
            'x-actor-email': actorEmail,
            'x-source': 'muxro-crm',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const data = response.data;
      this.logger.log(`Process Sutra flow started successfully: ${JSON.stringify(data)}`);
      return {
        success: true,
        flowId: data.flowId || data.id,
        data,
      };
    } catch (error: any) {
      const status = error.response?.status || 'Unknown';
      this.logger.error(`Process Sutra error: ${status}`);
      throw new BadRequestException('Failed to start Process Sutra flow');
    }
  }
}
