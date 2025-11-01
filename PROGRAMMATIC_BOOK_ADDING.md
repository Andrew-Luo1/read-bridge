# Programmatic Markdown Book Addition

This document explains how to programmatically add markdown books to ReadBridge's library.

## Overview

The implementation adds a feature to automatically scan directories for markdown files and add them to the library. This works in **both the Tauri desktop version and modern web browsers** using the File System Access API.

## Architecture

### Backend (Rust - Tauri)

Located in `src-tauri/src/lib.rs`:

1. **Tauri Command**: `scan_directory_for_books`
   - Scans a directory for markdown files
   - Returns count of files found
   - Note: The actual book processing happens on the frontend

2. **Tauri Plugins Added**:
   - `tauri-plugin-fs`: File system operations
   - `tauri-plugin-dialog`: File/directory picker dialogs

3. **Permissions**: Added to `src-tauri/capabilities/default.json`:
   - `core:path:allow-read-dir`
   - `core:path:allow-read-file`
   - `core:fs:allow-read-dir`
   - `core:fs:allow-read-file`
   - `dialog:allow-open`

### Frontend Services

#### 1. `services/TauriService.ts`
Provides a unified interface for both Tauri and browser:

- `isTauri()`: Detects if running in Tauri desktop mode
- `selectDirectory()`: Opens directory picker dialog (native dialog in Tauri, File System Access API in browser)
- `readMarkdownFilesFromDirectory(dirPath)`: Reads all `.md` and `.markdown` files from a directory
  - Uses Tauri's file system API in desktop mode
  - Uses browser's File System Access API in web mode
- `scanDirectoryForBooks(dirPath)`: Calls the Rust command (Tauri only)

#### 2. `services/BookScanner.ts`
High-level service for book scanning and adding:

- `BookScanner.scanDirectory(directory)`: Main method to scan and add books
  - Reads all markdown files from directory
  - Processes each file through the existing book upload pipeline
  - Returns scan results with counts and errors
- `BookScanner.addBookFromFile(file)`: Processes a single File object
- `BookScanner.addBooksFromFiles(files)`: Processes multiple files
- `BookScanner.bookExists(hash)`: Checks if a book already exists

### UI Components

#### `app/components/BookDirectoryScanner/index.tsx`
A button component that:
- Appears next to the book uploader in the grid
- Opens a directory picker when clicked
- Scans the selected directory for markdown files
- Shows loading state during scanning
- Displays results (success, skipped, errors)

## How It Works

### User Flow

1. User clicks "Scan Directory" button in the library
2. Directory picker dialog opens
3. User selects a directory containing markdown files
4. Frontend reads all `.md` and `.markdown` files from that directory
5. Each file is processed through the existing book upload pipeline:
   - File hash is calculated (SHA-256)
   - Book is parsed and structured (via `services/MD.ts`)
   - Book is added to IndexedDB (via `services/DB.ts`)
   - Reading progress is initialized
6. Results are displayed to the user

### Technical Flow

```
User Click → BookDirectoryScanner
            ↓
            TauriService.selectDirectory() → Opens native dialog
            ↓
            TauriService.readMarkdownFilesFromDirectory() → Reads files via Tauri API
            ↓
            BookScanner.scanDirectory()
            ↓
            For each file:
              BookScanner.addBookFromFile()
              ↓
              ServerUpload.handleFileUpload()
              ↓
              BookService.processBook()
              ↓
              MD.initMDBook() → Parses markdown
              ↓
              DB.addBook() → Saves to IndexedDB
```

## Usage

### As a User

1. Run the app in Tauri desktop mode: `npm run tauri dev`
2. Go to the home/library page
3. Click the "Scan Directory" button
4. Select a directory containing markdown files
5. Wait for the scan to complete
6. Books automatically appear in your library

### As a Developer

To programmatically add books:

```typescript
import { BookScanner } from '@/services/BookScanner';

// Scan a directory
const result = await BookScanner.scanDirectory('/path/to/books');
console.log(`Added ${result.added} books, ${result.skipped} skipped`);

// Add a single file
const file = new File([content], 'book.md', { type: 'text/markdown' });
const { id, book } = await BookScanner.addBookFromFile(file);

// Check if book exists
const exists = await BookScanner.bookExists(hash);
```

## Book Processing Details

When a markdown file is added:

1. **Hash Calculation**: SHA-256 of file content (used for duplicate detection)
2. **Parsing**: Uses `markdown-it` to convert markdown to HTML
3. **Chapter Detection**:
   - H2 headings create chapter breaks
   - If no H2 headings, entire file is one chapter
   - H3-H5 headings are converted to regular paragraphs
4. **Language Detection**: Uses `franc` library to detect language
5. **Storage**: Saved to IndexedDB with Dexie

## Limitations

- **Desktop Only**: Directory scanning only works in Tauri desktop mode, not in web browser
- **Manual Trigger**: Currently requires manual button click (no auto-scan on startup)
- **Single Directory**: Scans one directory at a time (no recursive scanning yet)
- **Duplicate Detection**: Based on file content hash, not filename

## Future Enhancements

Potential improvements:

1. **Auto-scan on Startup**: Scan a configured directory on app launch
2. **Recursive Scanning**: Scan subdirectories
3. **File Watching**: Automatically detect new files added to watched directories
4. **Web Support**: Use File System Access API for browser-based directory reading
5. **Progress Indication**: Show per-file progress during bulk scanning
6. **Selective Scanning**: Allow users to select which files to add

## Dependencies Added

### Rust (Cargo.toml)
- `tauri-plugin-fs = "2.0.0-rc"`
- `tauri-plugin-dialog = "2.0.0-rc"`

### TypeScript
No new dependencies were needed.

## Testing

To test the feature:

1. Create a test directory with some markdown files
2. Run `npm run tauri dev`
3. Click "Scan Directory" in the UI
4. Select your test directory
5. Verify books appear in the library
6. Try scanning again to verify duplicate detection

## Browser Support

The feature works in modern browsers that support the **File System Access API**:
- ✅ Chrome 86+
- ✅ Edge 86+
- ❌ Firefox (not yet supported)
- ❌ Safari (not yet supported)

In unsupported browsers, the button will still appear but opening the directory picker may fail gracefully.

## Troubleshooting

**"Tauri API is only available in desktop mode"**
- Only for Rust-specific commands; directory scanning works in browsers too

**"File System Access API not supported"**
- Use Chrome or Edge for browser-based scanning
- Or use the Tauri desktop app
- Or use the traditional drag-and-drop upload

**"Directory does not exist"**
- Ensure the directory path is valid and accessible

**"Book already exists"**
- The file content hash matches an existing book
- Safe to ignore or delete the existing book first

**Books not appearing**
- Check browser console for errors
- Verify markdown files are valid
- Check file size doesn't exceed 100MB limit

