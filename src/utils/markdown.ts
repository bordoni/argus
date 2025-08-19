import { Conversation, Thread, Attachment } from '../api/client';

export function conversationToMarkdown(conversation: Conversation, attachmentPaths: Map<string, string>): string {
  const lines: string[] = [];
  const threads = conversation._embedded?.threads || conversation.threads || [];
  
  // Calculate statistics
  const stats = calculateThreadStatistics(threads);
  
  lines.push(`# Conversation #${conversation.number}: ${conversation.subject}`);
  lines.push('');
  
  // Add summary statistics
  lines.push('## Summary');
  lines.push(`- **Total Threads**: ${stats.totalThreads}`);
  lines.push(`- **Customer Messages**: ${stats.customerMessages}`);
  lines.push(`- **Support Replies**: ${stats.supportReplies}`);
  lines.push(`- **Internal Notes**: ${stats.internalNotes}`);
  if (stats.totalAttachments > 0) {
    lines.push(`- **Attachments**: ${stats.totalAttachments}`);
  }
  if (stats.responseTime) {
    lines.push(`- **First Response Time**: ${stats.responseTime}`);
  }
  lines.push('');
  
  lines.push('## Metadata');
  lines.push(`- **ID**: ${conversation.id}`);
  lines.push(`- **Status**: ${conversation.status}`);
  lines.push(`- **Created**: ${formatDate(conversation.createdAt)}`);
  lines.push(`- **Modified**: ${formatDate(conversation.modifiedAt)}`);
  if (conversation.closedAt) {
    lines.push(`- **Closed**: ${formatDate(conversation.closedAt)}`);
  }
  if (conversation.mailbox?.name) {
    lines.push(`- **Mailbox**: ${conversation.mailbox.name}`);
  }
  if (conversation.createdBy) {
    lines.push(`- **Created By**: ${formatPerson(conversation.createdBy)}`);
  }
  if (conversation.primaryCustomer) {
    lines.push(`- **Customer**: ${formatPerson(conversation.primaryCustomer)}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Conversation Thread');
  lines.push('');
  
  for (const thread of threads) {
    lines.push(...formatThread(thread, attachmentPaths));
    lines.push('');
  }

  return lines.join('\n');
}

interface ThreadStatistics {
  totalThreads: number;
  customerMessages: number;
  supportReplies: number;
  internalNotes: number;
  totalAttachments: number;
  responseTime: string | null;
}

function calculateThreadStatistics(threads: Thread[]): ThreadStatistics {
  let customerMessages = 0;
  let supportReplies = 0;
  let internalNotes = 0;
  let totalAttachments = 0;
  let firstCustomerMessageTime: Date | null = null;
  let firstSupportReplyTime: Date | null = null;

  for (const thread of threads) {
    // Count attachments
    const attachments = thread._embedded?.attachments || thread.attachments || [];
    totalAttachments += attachments.length;

    // Categorize thread types
    const isCustomerThread = thread.type === 'customer' || thread.customer !== undefined;
    const isNote = thread.type === 'note';
    
    if (isNote) {
      internalNotes++;
    } else if (isCustomerThread) {
      customerMessages++;
      if (!firstCustomerMessageTime) {
        firstCustomerMessageTime = new Date(thread.createdAt);
      }
    } else if (thread.type === 'reply' || thread.type === 'message') {
      supportReplies++;
      if (!firstSupportReplyTime && firstCustomerMessageTime) {
        firstSupportReplyTime = new Date(thread.createdAt);
      }
    }
  }

  // Calculate response time
  let responseTime: string | null = null;
  if (firstCustomerMessageTime && firstSupportReplyTime) {
    const diffMs = firstSupportReplyTime.getTime() - firstCustomerMessageTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      responseTime = `${diffDays} day${diffDays !== 1 ? 's' : ''} ${diffHours % 24} hour${(diffHours % 24) !== 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      responseTime = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMins % 60} minute${(diffMins % 60) !== 1 ? 's' : ''}`;
    } else {
      responseTime = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
  }

  return {
    totalThreads: threads.length,
    customerMessages,
    supportReplies,
    internalNotes,
    totalAttachments,
    responseTime,
  };
}

function formatThread(thread: Thread, attachmentPaths: Map<string, string>): string[] {
  const lines: string[] = [];
  
  const author = thread.customer || thread.createdBy;
  const authorName = author ? formatPerson(author) : 'Unknown';
  const timestamp = formatDate(thread.createdAt);
  
  lines.push(`### ${getThreadTypeIcon(thread.type)} ${thread.type} by ${authorName}`);
  lines.push(`*${timestamp}*`);
  lines.push('');
  
  if (thread.action?.text) {
    lines.push(`**Action**: ${thread.action.text}`);
    lines.push('');
  }
  
  if (thread.body) {
    const cleanBody = cleanHtml(thread.body);
    lines.push(cleanBody);
    lines.push('');
  }
  
  const attachments = thread._embedded?.attachments || thread.attachments || [];
  if (attachments.length > 0) {
    lines.push('**Attachments:**');
    for (const attachment of attachments) {
      const localPath = attachmentPaths.get(`${thread.id}-${attachment.id}`);
      if (localPath) {
        lines.push(`- [${attachment.filename}](${localPath}) (${formatFileSize(attachment.size)})`);
      } else {
        lines.push(`- ${attachment.filename} (${formatFileSize(attachment.size)})`);
      }
    }
    lines.push('');
  }
  
  lines.push('---');
  
  return lines;
}

function getThreadTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'customer': '💬',
    'message': '📧',
    'reply': '↩️',
    'forward': '➡️',
    'note': '📝',
    'phone': '📞',
    'chat': '💭',
  };
  return icons[type.toLowerCase()] || '•';
}

function formatPerson(person: { email?: string; firstName?: string; lastName?: string }): string {
  if (!person) return 'Unknown';
  
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  if (name && person.email) {
    return `${name} (${person.email})`;
  }
  return name || person.email || 'Unknown';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/?div>/gi, '\n')
    .replace(/<blockquote>/gi, '> ')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<strong>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b>/gi, '**')
    .replace(/<\/b>/gi, '**')
    .replace(/<em>/gi, '*')
    .replace(/<\/em>/gi, '*')
    .replace(/<i>/gi, '*')
    .replace(/<\/i>/gi, '*')
    .replace(/<code>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<pre>/gi, '```\n')
    .replace(/<\/pre>/gi, '\n```')
    .replace(/<a\s+href="([^"]+)"[^>]*>/gi, '[')
    .replace(/<\/a>/gi, ']($1)')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}