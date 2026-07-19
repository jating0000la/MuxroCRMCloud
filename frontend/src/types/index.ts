export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  managerId?: string | null;
  manager?: { id: string; name: string; username: string };
  assignedUsers?: CampaignUser[];
  statuses?: CampaignStatus[];
  _count?: { leads: number; forms: number };
  createdAt: string;
  updatedAt?: string;
}

export interface CampaignUser {
  id: string;
  campaignId: string;
  userId: string;
  user?: User;
  isActive: boolean;
}

export interface CampaignStatus {
  id: string;
  campaignId: string;
  label: string;
  color: string;
  order: number;
  whatsappMessage?: string;
}

export interface Lead {
  id: string;
  campaignId: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  customData?: Record<string, unknown>;
  dnd?: boolean;
  doerId?: string;
  doer?: User;
  statusId?: string;
  status?: CampaignStatus;
  followups?: Followup[];
  campaign?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface Followup {
  id: string;
  leadId: string;
  userId: string;
  status: string;
  remarks?: string;
  nextCallDate?: string;
  createdAt: string;
  lead?: Lead;
  user?: { id: string; name: string; username: string };
}

export interface Form {
  id: string;
  campaignId: string;
  title: string;
  fields: FormField[];
  isPublished: boolean;
  publicSlug: string;
  _count?: { submissions: number };
  createdAt: string;
  updatedAt?: string;
}

export interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  rows?: string[];
  columns?: string[];
}

export interface Enquiry {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  submittedAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface DashboardStats {
  totalCampaigns: number;
  totalLeads: number;
  todayFollowups: number;
  totalUsers: number;
}
