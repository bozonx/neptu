mod file_ops;
mod git;
mod image_convert;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            git::git_is_repo,
            git::git_init_repo,
            git::git_status,
            git::git_global_author,
            git::git_commit_all,
            git::git_pull,
            git::git_push,
            git::git_diff,
            file_ops::write_text_atomic,
            image_convert::convert_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
