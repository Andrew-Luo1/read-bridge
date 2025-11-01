/**
 * Tauri frontend service to interact with Tauri backend commands
 * This provides a way to call Rust functions from the frontend
 */

// Browser File System Access API types (when not available in TypeScript)
interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
}

declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      dialog: {
        open: (options?: {
          directory?: boolean;
          multiple?: boolean;
          filters?: Array<{ name: string; extensions: string[] }>;
        }) => Promise<string | string[] | null>;
      };
      fs: {
        readDir: (path: string) => Promise<Array<{ name: string; path: string; isFile: boolean }>>;
        readFile: (path: string) => Promise<Uint8Array>;
      };
    };
    showDirectoryPicker?: (options?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>;
  }
}

// Export types for use in other modules
export type { FileSystemDirectoryHandle, FileSystemHandle, FileSystemFileHandle };

/**
 * Check if the app is running in Tauri desktop mode
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';
}

/**
 * Scan a directory for markdown files
 * Note: This Rust command is only available in Tauri mode
 */
export async function scanDirectoryForBooks(dirPath: string): Promise<{
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}> {
  if (!isTauri()) {
    throw new Error('Tauri API is only available in desktop mode');
  }

  const result = await window.__TAURI__!.invoke<{
    total: number;
    added: number;
    skipped: number;
    errors: string[];
  }>('scan_directory_for_books', { dir_path: dirPath });

  return result;
}

/**
 * Open a directory picker dialog
 * Works in both Tauri desktop mode and modern browsers
 * Returns: file path string in Tauri mode, FileSystemDirectoryHandle in browser mode
 */
export async function selectDirectory(): Promise<string | FileSystemDirectoryHandle | null> {
  if (isTauri()) {
    const result = await window.__TAURI__!.dialog.open({
      directory: true,
      multiple: false,
    });

    if (Array.isArray(result)) {
      return result[0] || null;
    }

    return result || null;
  } else {
    // Use File System Access API for browsers
    try {
      const dirHandle = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      return dirHandle;
    } catch (error) {
      // User cancelled or API not supported
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('File System Access API not supported:', error);
      }
      return null;
    }
  }
}

/**
 * Read all markdown files from a directory
 * Works in both Tauri desktop mode and modern browsers
 */
export async function readMarkdownFilesFromDirectory(dirPath: string | FileSystemDirectoryHandle): Promise<File[]> {
  const markdownFiles: File[] = [];

  if (isTauri()) {
    // Tauri mode: read from file system path
    const entries = await window.__TAURI__!.fs.readDir(dirPath as string);
    
    for (const entry of entries) {
      if (entry.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
        try {
          const bytes = await window.__TAURI__!.fs.readFile(entry.path);
          const blob = new Blob([new Uint8Array(bytes)], { type: 'text/markdown' });
          const file = new File([blob], entry.name, { type: 'text/markdown' });
          markdownFiles.push(file);
        } catch (error) {
          console.error(`Failed to read file ${entry.path}:`, error);
        }
      }
    }
  } else {
    // Browser mode: use File System Access API
    const dirHandle = dirPath as FileSystemDirectoryHandle;
    
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          try {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            // Browser File System Access API doesn't always set MIME type
            // Fix it if missing to ensure isValidBookFormat passes
            if (!file.type && entry.name.endsWith('.md')) {
              const fixedFile = new File([file], entry.name, { type: 'text/markdown' });
              markdownFiles.push(fixedFile);
            } else {
              markdownFiles.push(file);
            }
          } catch (error) {
            console.error(`Failed to read file ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to read directory:', error);
    }
  }

  return markdownFiles;
}

export default {
  isTauri,
  scanDirectoryForBooks,
  selectDirectory,
  readMarkdownFilesFromDirectory,
};

