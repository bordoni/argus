import chalk from 'chalk';
import { HelpScoutClient, Conversation, Thread, Attachment } from '../api/client';
import { conversationToMarkdown } from '../utils/markdown';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export { setupCommand } from './setup';

interface DownloadOptions {
  output: string;
}

export async function downloadConversation(link: string, options: DownloadOptions) {
  const client = new HelpScoutClient();
  
  try {
    console.log(chalk.cyan('🔐 Authenticating with HelpScout...'));
    await client.authenticate();
    
    const conversationId = client.extractConversationId(link);
    console.log(chalk.gray(`Conversation ID: ${conversationId}`));
    
    console.log(chalk.cyan('📥 Fetching conversation data...'));
    const conversation = await client.getConversation(conversationId);
    
    console.log(chalk.green(`✅ Found conversation #${conversation.number}: ${conversation.subject}`));
    
    const outputDir = join(options.output, conversationId);
    const attachmentsDir = join(outputDir, 'attachments');
    
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const threads = conversation._embedded?.threads || conversation.threads || [];
    console.log(chalk.gray(`Found ${threads.length} threads`));
    
    const attachmentPaths = new Map<string, string>();
    let totalAttachments = 0;
    
    for (const thread of threads) {
      const attachments = thread._embedded?.attachments || thread.attachments || [];
      totalAttachments += attachments.length;
    }
    
    if (totalAttachments > 0) {
      console.log(chalk.cyan(`📎 Downloading ${totalAttachments} attachments...`));
      
      if (!existsSync(attachmentsDir)) {
        mkdirSync(attachmentsDir, { recursive: true });
      }
      
      let downloadedCount = 0;
      
      for (const thread of threads) {
        const attachments = thread._embedded?.attachments || thread.attachments || [];
        
        for (const attachment of attachments) {
          try {
            const sanitizedFilename = sanitizeFilename(attachment.filename);
            const uniqueFilename = `${thread.id}_${attachment.id}_${sanitizedFilename}`;
            const attachmentPath = join(attachmentsDir, uniqueFilename);
            
            console.log(chalk.gray(`  Downloading: ${attachment.filename}...`));
            
            const data = await client.downloadAttachment(conversationId, attachment);
            await writeFile(attachmentPath, data);
            
            const relativePath = `./attachments/${uniqueFilename}`;
            attachmentPaths.set(`${thread.id}-${attachment.id}`, relativePath);
            
            downloadedCount++;
            console.log(chalk.green(`  ✓ Downloaded: ${attachment.filename} (${downloadedCount}/${totalAttachments})`));
          } catch (error) {
            console.log(chalk.yellow(`  ⚠️  Failed to download: ${attachment.filename}`));
            console.log(chalk.gray(`     ${error}`));
          }
        }
      }
    }
    
    console.log(chalk.cyan('📝 Converting to Markdown...'));
    const markdown = conversationToMarkdown(conversation, attachmentPaths);
    
    const markdownPath = join(outputDir, `conversation_${conversationId}.md`);
    await writeFile(markdownPath, markdown, 'utf-8');
    
    const metadataPath = join(outputDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify({
      id: conversation.id,
      number: conversation.number,
      subject: conversation.subject,
      status: conversation.status,
      createdAt: conversation.createdAt,
      modifiedAt: conversation.modifiedAt,
      closedAt: conversation.closedAt,
      mailbox: conversation.mailbox,
      downloadedAt: new Date().toISOString(),
      attachmentCount: totalAttachments,
    }, null, 2), 'utf-8');
    
    console.log(chalk.green('\n✅ Conversation downloaded successfully!'));
    console.log(chalk.gray(`📁 Output directory: ${outputDir}`));
    console.log(chalk.gray(`📄 Markdown file: ${markdownPath}`));
    if (totalAttachments > 0) {
      console.log(chalk.gray(`📎 Attachments: ${attachmentsDir}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error downloading conversation:'), error);
    process.exit(1);
  }
}

export async function conversationsCommand() {
  console.log(chalk.cyan('Conversations management commands'));
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}