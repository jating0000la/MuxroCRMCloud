export interface TransferLeadPayload {
  campaignId?: string;
  doerId?: string;
  statusId?: string;
}

export function getTransferUpdatePayload(
  dto: TransferLeadPayload,
  currentCampaignId: string,
  currentStatusId?: string,
  targetStatuses: Array<{ id: string; campaignId?: string }> = [],
): TransferLeadPayload {
  const next: TransferLeadPayload = {};

  if (dto.campaignId !== undefined && dto.campaignId !== currentCampaignId) {
    next.campaignId = dto.campaignId;
  }

  if (dto.doerId !== undefined) {
    next.doerId = dto.doerId;
  }

  if (dto.campaignId !== undefined && currentStatusId) {
    const sameCampaignStatus = targetStatuses.find((status) => status.campaignId === dto.campaignId);
    if (sameCampaignStatus) {
      next.statusId = sameCampaignStatus.id;
    } else {
      next.statusId = currentStatusId;
    }
  }

  return next;
}
