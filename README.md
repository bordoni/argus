# Argus - HelpScout CLI Tool

A command-line tool for downloading HelpScout conversations with attachments, built with Bun and TypeScript.

## Features

- Interactive setup for HelpScout API credentials
- OAuth 2.0 authentication flow
- Download entire conversations as Markdown files
- Automatic attachment download
- Organized output structure with conversation IDs

## Installation

### Option 1: Install from npm (Recommended)

```bash
# Install globally using Bun
bun install -g @bordoni/argus

# Or install globally using npm
npm install -g @bordoni/argus
```

After global installation, you can use the `argus` command directly:

```bash
argus setup
argus conversations download <link>
```

### Option 2: Use Standalone Binary

Download the pre-built binary for your platform from the [releases page](https://github.com/bordoni/argus/releases):

- **macOS (Intel)**: `argus-mac`
- **macOS (Apple Silicon)**: `argus-mac-arm`
- **Linux**: `argus-linux`
- **Windows**: `argus-windows.exe`

Make it executable (macOS/Linux):
```bash
chmod +x argus-mac  # or argus-linux
sudo mv argus-mac /usr/local/bin/argus  # Optional: move to PATH
```

### Option 3: Install from Source

```bash
# Clone the repository
git clone https://github.com/bordoni/argus.git
cd argus

# Install dependencies
bun install

# Link globally for development
bun link
```

Now you can use `argus` command globally.

## Setup

First, run the interactive setup to configure your HelpScout API credentials:

```bash
argus setup
```

This will prompt you for:
- **App ID**: Your HelpScout application ID
- **App Secret**: Your HelpScout application secret  
- **Port**: Local server port for OAuth callback (default: 3000)

### Getting HelpScout API Credentials

1. Go to [HelpScout Settings > Apps](https://secure.helpscout.net/settings/apps/)
2. Click "Create My App"
3. Enter a name and set the Redirect URL to `http://localhost:3000/callback`
4. Save the App ID and App Secret

## Usage

### Download a Conversation

```bash
argus conversations download <link>
```

Where `<link>` can be:
- Full HelpScout URL: `https://secure.helpscout.net/conversation/123456789/...`
- Conversation ID: `123456789`

### Options

- `-o, --output <dir>`: Specify output directory (default: `./conversations`)

### Example

```bash
argus conversations download https://secure.helpscout.net/conversation/123456789/
```

## Output Structure

```
conversations/
└── 123456789/
    ├── conversation_123456789.md   # Markdown formatted conversation
    ├── metadata.json                # Conversation metadata
    └── attachments/                 # Downloaded attachments
        ├── threadId_attachmentId_filename.pdf
        └── ...
```

## Building from Source

### Build Standalone Binary

To compile a standalone executable for your current platform:

```bash
bun run build
```

This creates an `argus` binary that can be run without Bun installed.

### Build for All Platforms

To build binaries for all supported platforms:

```bash
bun run build:all
```

This creates binaries in the `dist/` directory:
- `argus-linux` - Linux x64
- `argus-mac` - macOS Intel
- `argus-mac-arm` - macOS Apple Silicon
- `argus-windows.exe` - Windows x64

## Development

```bash
# Install dependencies
bun install

# Link for global development
bun link

# Run in watch mode
bun run dev

# Run directly
bun run start

# Test npm package locally
bun publish --dry-run

# Unlink when done
bun unlink
```

## Requirements

- Bun runtime (for development) or use standalone binary
- HelpScout account with API access
- Valid HelpScout App credentials

## Publishing

### Publishing to npm

```bash
# Dry run to test
bun publish --dry-run

# Publish to npm
bun publish
```

### Creating GitHub Release

1. Build all platform binaries:
   ```bash
   bun run build:all
   ```

2. Create a new release on GitHub
3. Upload the binaries from `dist/` directory

## License

MIT
