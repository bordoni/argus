import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth';

export interface Conversation {
  id: number;
  number: number;
  subject: string;
  status: string;
  createdAt: string;
  modifiedAt: string;
  closedAt?: string;
  mailbox: {
    id: number;
    name: string;
  };
  createdBy: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
  primaryCustomer: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  threads?: Thread[];
  _embedded?: {
    threads: Thread[];
  };
}

export interface Thread {
  id: number;
  type: string;
  status: string;
  state: string;
  action: {
    type: string;
    text?: string;
  };
  body: string;
  source: {
    type: string;
    via: string;
  };
  customer?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  createdBy?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    type: string;
  };
  createdAt: string;
  attachments?: Attachment[];
  _embedded?: {
    attachments: Attachment[];
  };
}

export interface Attachment {
  id: number;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  size: number;
  state: string;
  _links?: {
    data?: {
      href: string;
    };
  };
}

export class HelpScoutClient {
  private oauth: OAuthManager;
  private baseUrl = 'https://api.helpscout.net/v2';

  constructor() {
    this.oauth = new OAuthManager();
  }

  async authenticate(): Promise<void> {
    try {
      await this.oauth.getValidToken();
      console.log(chalk.green('✅ Already authenticated'));
    } catch (error) {
      console.log(chalk.yellow('🔐 Authentication required'));
      const code = await this.oauth.startAuthServer();
      await this.oauth.exchangeCodeForToken(code);
      console.log(chalk.green('✅ Authentication successful'));
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.oauth.getValidToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HelpScout API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  extractConversationId(link: string): string {
    const patterns = [
      /conversation\/(\d+)/,
      /conversations\/(\d+)/,
      /^(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) {
        return match[1];
      }
    }

    throw new Error(`Could not extract conversation ID from: ${link}`);
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${conversationId}?embed=threads`);
  }

  async getThreads(conversationId: string): Promise<Thread[]> {
    const response = await this.request<{ _embedded: { threads: Thread[] } }>(
      `/conversations/${conversationId}/threads`
    );
    return response._embedded.threads;
  }

  async getAttachmentData(conversationId: string, attachmentId: number): Promise<{ data: string; filename: string; mimeType: string }> {
    const response = await this.request<{ data: string; filename: string; mimeType: string }>(
      `/conversations/${conversationId}/attachments/${attachmentId}/data`
    );
    return response;
  }

  async downloadAttachment(conversationId: string, attachment: Attachment): Promise<Buffer> {
    if (!attachment._links?.data?.href) {
      throw new Error(`No download link available for attachment ${attachment.filename}`);
    }

    const token = await this.oauth.getValidToken();
    const response = await fetch(attachment._links.data.href, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment ${attachment.filename}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}