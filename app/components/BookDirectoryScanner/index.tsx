'use client';

import { useState } from 'react';
import { message, Spin } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { selectDirectory } from '@/services/TauriService';
import { BookScanner } from '@/services/BookScanner';

export default function BookDirectoryScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const handleScanDirectory = async () => {
    try {
      setIsScanning(true);
      
      // Open directory picker (works in both Tauri and modern browsers)
      const selectedDir = await selectDirectory();
      
      if (!selectedDir) {
        // User cancelled
        return;
      }

      // Show loading message
      const loadingMessage = message.loading('Scanning directory for books...', 0);

      try {
        // Scan directory and add books
        const result = await BookScanner.scanDirectory(selectedDir);
        
        // Close loading message
        loadingMessage();

        // Show results
        if (result.errors.length > 0) {
          message.warning(
            `Added ${result.added} books, ${result.skipped} skipped, ${result.errors.length} errors`
          );
        } else if (result.added > 0 || result.skipped > 0) {
          message.success(`Added ${result.added} books, ${result.skipped} already in library`);
        } else {
          message.info('No books found in the selected directory');
        }
      } catch (error) {
        loadingMessage();
        throw error;
      }
    } catch (error) {
      console.error('Failed to scan directory:', error);
      message.error(error instanceof Error ? error.message : 'Failed to scan directory');
    } finally {
      setIsScanning(false);
    }
  };

  const buttonCSS = `
    w-full
    h-full
    flex
    flex-col
    items-center
    justify-center
    border
    border-[var(--ant-color-border)]
    rounded-lg
    bg-[var(--ant-color-bg-elevated)]
    dark:bg-[var(--ant-color-bg-elevated)]
    hover:bg-[var(--ant-color-fill-tertiary)]
    dark:hover:bg-[var(--ant-color-fill-tertiary)]
    transition-colors
    cursor-pointer
    relative
  `;

  return (
    <div className={buttonCSS} onClick={handleScanDirectory}>
      {isScanning && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.8)] dark:bg-[rgba(0,0,0,0.8)] rounded-lg">
          <Spin size="large" />
        </div>
      )}
      <FolderOpenOutlined className="text-2xl text-[var(--ant-color-text-tertiary)] mb-2" />
      <span className="text-sm text-[var(--ant-color-text-secondary)]">
        {isScanning ? 'Scanning...' : 'Scan Directory'}
      </span>
    </div>
  );
}

