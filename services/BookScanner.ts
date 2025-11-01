import { handleFileUpload } from './ServerUpload';
import db from './DB';
import type { Book } from '@/types/book';
import { readMarkdownFilesFromDirectory, type FileSystemDirectoryHandle } from './TauriService';

/**
 * Scans a directory for markdown files and adds them to the library
 * This is a client-side implementation that requires file system access
 * through Tauri's file system API or browser's File System Access API
 */
export class BookScanner {
  private static watchedDirectory: string | null = null;

  /**
   * Scan a directory for markdown files and add them to the library
   * @param directory Path to the directory to scan (string in Tauri, FileSystemDirectoryHandle in browser)
   */
  static async scanDirectory(directory: string | FileSystemDirectoryHandle): Promise<ScanResult> {
    const result: ScanResult = {
      total: 0,
      added: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Read markdown files from directory (works in both Tauri and browser mode)
      const files = await readMarkdownFilesFromDirectory(directory);
      result.total = files.length;

      // Process each file
      for (const file of files) {
        try {
          await this.addBookFromFile(file);
          result.added++;
        } catch (error) {
          if (error instanceof Error && error.message === 'Book already exists') {
            result.skipped++;
          } else {
            result.errors.push({
              filename: file.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Programmatically add a markdown book from a file path
   * This requires file system access
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async addBookFromPath(_filePath: string): Promise<string> {
    // Placeholder for Tauri file system integration
    throw new Error('addBookFromPath requires Tauri file system access - not yet implemented');
  }

  /**
   * Add a book directly from a File object
   * This is the main entry point for adding books
   */
  static async addBookFromFile(file: File): Promise<{ id: string; book: Book }> {
    try {
      const book = await handleFileUpload(file);
      const id = await db.addBook(book);
      await db.addReadingProgress(id);
      
      return { id, book };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  /**
   * Add multiple books from File objects
   */
  static async addBooksFromFiles(files: File[]): Promise<ScanResult> {
    const result: ScanResult = {
      total: files.length,
      added: 0,
      skipped: 0,
      errors: [],
    };

    for (const file of files) {
      try {
        await this.addBookFromFile(file);
        result.added++;
      } catch (error) {
        if (error instanceof Error && error.message === 'Book already exists') {
          result.skipped++;
        } else {
          result.errors.push({
            filename: file.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  /**
   * Check if a book already exists in the library by file hash
   */
  static async bookExists(hash: string): Promise<boolean> {
    const book = await db.books.where('fileHash').equals(hash).first();
    return !!book;
  }

  /**
   * Set a directory to watch for new markdown files
   * (Future enhancement for auto-detection)
   */
  static setWatchedDirectory(directory: string) {
    this.watchedDirectory = directory;
  }
}

export interface ScanResult {
  total: number;
  added: number;
  skipped: number;
  errors: Array<{
    filename: string;
    error: string;
  }>;
}

export default BookScanner;

