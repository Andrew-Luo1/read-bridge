use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct ScanResult {
    total: usize,
    added: usize,
    skipped: usize,
    errors: Vec<String>,
}

/// Scan a directory for markdown files
#[tauri::command]
async fn scan_directory_for_books(dir_path: String) -> Result<ScanResult, String> {
    let path = PathBuf::from(&dir_path);
    
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let mut result = ScanResult {
        total: 0,
        added: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    // Read directory entries
    let entries = match std::fs::read_dir(&path) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    };

    for entry in entries {
        if let Ok(entry) = entry {
            let file_path = entry.path();
            
            // Check if it's a markdown file
            if let Some(ext) = file_path.extension() {
                if ext == "md" || ext == "markdown" {
                    result.total += 1;
                    // Note: You'll need to call the frontend's addBook function
                    // or implement the book processing logic here
                    // For now, we just count the files
                }
            }
        }
    }

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![scan_directory_for_books])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
