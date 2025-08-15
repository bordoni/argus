import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const EnvSchema = z.object({
  APP_ID: z.string().min(1),
  APP_SECRET: z.string().min(1),
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1024).max(65535)),
  REDIRECT_URI: z.string().url().optional(),
});

export async function setupCommand() {
  console.log(chalk.cyan('🔧 HelpScout CLI Setup\n'));
  
  const port = await input({
    message: 'Enter the OAuth callback server port:',
    default: '3000',
    validate: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num)) return 'Port must be a number';
      if (num < 1024 || num > 65535) return 'Port must be between 1024 and 65535';
      return true;
    },
  });
  
  const redirectUri = `http://localhost:${port}/callback`;
  
  console.log(chalk.yellow('\n📌 Configure your HelpScout App with this Redirect URL:'));
  console.log(chalk.cyan.bold(`   ${redirectUri}\n`));
  console.log(chalk.gray('Steps to get your API credentials:'));
  console.log(chalk.gray('1. Go to: https://secure.helpscout.net/users/apps'));
  console.log(chalk.gray('2. Click "Create App" or edit an existing app'));
  console.log(chalk.gray(`3. Set the Redirect URL to: ${redirectUri}`));
  console.log(chalk.gray('4. Save and copy your App ID and App Secret\n'));

  try {
    const appId = await input({
      message: 'Enter your HelpScout App ID:',
      validate: (value) => value.length > 0 || 'App ID is required',
    });

    const appSecret = await input({
      message: 'Enter your HelpScout App Secret:',
      validate: (value) => value.length > 0 || 'App Secret is required',
    });
    
    const config = {
      APP_ID: appId,
      APP_SECRET: appSecret,
      PORT: port,
      REDIRECT_URI: redirectUri,
    };

    const validation = EnvSchema.safeParse(config);
    if (!validation.success) {
      console.log(chalk.red('❌ Invalid configuration:'));
      validation.error.errors.forEach(err => {
        console.log(chalk.red(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const envContent = `# HelpScout API Configuration
APP_ID=${appId}
APP_SECRET=${appSecret}
PORT=${port}
REDIRECT_URI=${redirectUri}
`;

    const save = await confirm({
      message: `Save configuration to .env file? (Redirect URI will be: ${chalk.green(redirectUri)})`,
      default: true,
    });

    if (save) {
      const envPath = join(process.cwd(), '.env');
      await writeFile(envPath, envContent, 'utf-8');
      console.log(chalk.green('✅ Configuration saved to .env file'));
      console.log(chalk.yellow('\n⚠️  Remember: Your HelpScout app must be configured with:'));
      console.log(chalk.cyan(`   Redirect URL: ${redirectUri}\n`));
      console.log(chalk.gray('Update it at: https://secure.helpscout.net/users/apps'));
    } else {
      console.log(chalk.yellow('Configuration not saved.'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log(chalk.yellow('\n\nSetup cancelled.'));
    } else {
      console.log(chalk.red('\n❌ Setup failed:'), error);
    }
    process.exit(1);
  }
}