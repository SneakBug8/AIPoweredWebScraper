# BackupService

The `BackupService` ensures the persistence of application data by creating periodic archives and offloading them to remote storage.

## Approach
1.  **Local Archiving:** Uses the `archiver` library to create a ZIP file containing the `data/` and `diary/` directories.
2.  **Scheduling:** Integrated with the `Scheduler` to run at specific hours (e.g., 19:00) every few days.
3.  **Remote Upload:** Uses `basic-ftp` to upload the ZIP archive to a pre-configured FTP server.

## Subjective Decision-Making
-   **FTP over Telegram:** While the bot can send files, Telegram has size limits (and potential privacy concerns). Uploading directly to a private FTP server was chosen for reliability and to handle larger backup sets without manual intervention.
-   **Full Backups:** The service performs full backups rather than incremental ones. While less storage-efficient, it makes recovery significantly simpler and less error-prone.

## Benefits over Market Solutions
-   **Zero Cost:** Utilizes existing infrastructure (FTP) rather than expensive cloud backup services.
-   **Self-Contained:** The backup logic is part of the application, ensuring that configuration and data are always backed up together.
-   **Asynchronous Processing:** Backups run in the background without blocking the bot's responsiveness to users.

## Critiques & Suggestions for Improvement
-   **Critique:** Performing a full ZIP archive of the data directory every few days is inefficient as the data grows. FTP is also an unencrypted protocol in its standard form, which could expose sensitive data during transit.
-   **Suggestion:** Implement incremental backups or use a tool like `rsync` for more efficient data transfer. Switch to SFTP or FTPS to ensure data is encrypted while in transit to the remote server.
