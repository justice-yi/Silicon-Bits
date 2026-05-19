package database

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=1&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	// Note: not using SetMaxOpenConns(1) — it causes deadlocks with FTS rebuild queries

	if err := migrate(); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	if err := SeedBSPModules(); err != nil {
		return fmt.Errorf("seed BSP modules: %w", err)
	}

	// Periodic WAL checkpoint to prevent unbounded WAL growth
	go walCheckpoint()

	// Periodic database backup
	go backupLoop(dbPath)

	return nil
}

// backupLoop runs a backup every 6 hours, keeps last 7 days of backups.
func backupLoop(dbPath string) {
	// Wait 5 minutes after start before first backup
	time.Sleep(5 * time.Minute)
	runBackup(dbPath)

	for {
		time.Sleep(6 * time.Hour)
		runBackup(dbPath)
	}
}

// runBackup checkpoints WAL, copies the .db file to data/backups/, cleans old backups.
func runBackup(dbPath string) {
	// Checkpoint WAL so all data is in the main .db file
	if DB != nil {
		DB.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
	}

	backupDir := filepath.Join(filepath.Dir(dbPath), "backups")
	os.MkdirAll(backupDir, 0755)

	timestamp := time.Now().Format("20060102-150405")
	backupPath := filepath.Join(backupDir, "silicon-"+timestamp+".db")

	src, err := os.Open(dbPath)
	if err != nil {
		return
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return
	}
	defer dst.Close()

	io.Copy(dst, src)

	// Clean backups older than 7 days
	cleanOldBackups(backupDir, 7*24*time.Hour)
}

// cleanOldBackups removes backup files older than maxAge.
func cleanOldBackups(backupDir string, maxAge time.Duration) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return
	}

	cutoff := time.Now().Add(-maxAge)
	var files []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), "silicon-") {
			continue
		}
		files = append(files, e.Name())
	}

	// Sort by name (timestamp), keep at least 4 newest even if old
	sort.Strings(files)
	keepMin := 4

	for i, name := range files {
		path := filepath.Join(backupDir, name)
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		// Skip the newest keepMin entries
		if len(files)-i <= keepMin {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(path)
		}
	}
}

func walCheckpoint() {
	for {
		time.Sleep(30 * time.Second)
		if DB != nil {
			DB.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		}
	}
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS bsp_modules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		parent_id INTEGER REFERENCES bsp_modules(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		slug TEXT UNIQUE NOT NULL,
		icon TEXT,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS bugs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		bsp_module_id INTEGER REFERENCES bsp_modules(id),
		severity TEXT CHECK(severity IN ('critical','major','minor','cosmetic')) DEFAULT 'major',
		kernel_version TEXT,
		soc TEXT,
		tags TEXT DEFAULT '[]',
		background TEXT NOT NULL DEFAULT '',
		debug_process TEXT DEFAULT '',
		root_cause TEXT NOT NULL DEFAULT '',
		solution TEXT DEFAULT '',
		content TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS wikis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		category TEXT DEFAULT 'other',
		tags TEXT DEFAULT '[]',
		content TEXT NOT NULL DEFAULT '',
		source TEXT DEFAULT 'original',
		file_path TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS bug_relations (
		bug_id INTEGER REFERENCES bugs(id) ON DELETE CASCADE,
		related_bug_id INTEGER REFERENCES bugs(id) ON DELETE CASCADE,
		PRIMARY KEY (bug_id, related_bug_id)
	);

	CREATE TABLE IF NOT EXISTS bug_wiki_relations (
		bug_id INTEGER REFERENCES bugs(id) ON DELETE CASCADE,
		wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
		PRIMARY KEY (bug_id, wiki_id)
	);

	CREATE INDEX IF NOT EXISTS idx_bugs_bsp ON bugs(bsp_module_id);
	CREATE INDEX IF NOT EXISTS idx_bugs_created ON bugs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
	CREATE INDEX IF NOT EXISTS idx_wikis_category ON wikis(category);
	CREATE INDEX IF NOT EXISTS idx_wikis_created ON wikis(created_at DESC);

	-- Auto-update updated_at
	CREATE TRIGGER IF NOT EXISTS bugs_updated AFTER UPDATE ON bugs BEGIN
		UPDATE bugs SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
	END;
	CREATE TRIGGER IF NOT EXISTS wikis_updated AFTER UPDATE ON wikis BEGIN
		UPDATE wikis SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
	END;
	`
	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// Migrate existing tables: add columns that may be missing
	DB.Exec("ALTER TABLE wikis ADD COLUMN file_path TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE bugs ADD COLUMN content TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE wikis ADD COLUMN bsp_module_id INTEGER REFERENCES bsp_modules(id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_wikis_bsp ON wikis(bsp_module_id)")

	// Migrate old 4-field bugs into unified content
	migrateBugContent()

	// Setup FTS (standalone, no content= — avoids corruption)
	setupFTS()

	return nil
}

// setupFTS creates FTS5 tables if they don't exist and rebuilds the index.
// Uses standalone FTS (no content= table) to avoid corruption issues.
func setupFTS() {
	// Drop old content-sync FTS if exists (they cause corruption)
	DB.Exec("DROP TABLE IF EXISTS bugs_fts")
	DB.Exec("DROP TABLE IF EXISTS wikis_fts")
	DB.Exec("DROP TRIGGER IF EXISTS bugs_fts_insert")
	DB.Exec("DROP TRIGGER IF EXISTS bugs_fts_update")
	DB.Exec("DROP TRIGGER IF EXISTS bugs_fts_delete")
	DB.Exec("DROP TRIGGER IF EXISTS wikis_fts_insert")
	DB.Exec("DROP TRIGGER IF EXISTS wikis_fts_update")
	DB.Exec("DROP TRIGGER IF EXISTS wikis_fts_delete")

	// Create standalone FTS tables (store their own content, no content= reference)
	DB.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS bugs_fts USING fts5(
		title, background, debug_process, root_cause, solution
	)`)
	DB.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS wikis_fts USING fts5(
		title, content
	)`)

	// Rebuild from source tables
	RebuildFTS()
}

// RebuildFTS does a full rebuild of FTS indexes from bugs/wikis tables.
// Exported so it can be called after wiki scan.
func RebuildFTS() {
	DB.Exec("DELETE FROM bugs_fts")
	DB.Exec("DELETE FROM wikis_fts")
	DB.Exec("INSERT INTO bugs_fts(rowid, title, background, debug_process, root_cause, solution) SELECT id, title, background, debug_process, root_cause, solution FROM bugs")
	DB.Exec("INSERT INTO wikis_fts(rowid, title, content) SELECT id, title, content FROM wikis")
}

// SyncBugFTS updates the FTS index for a single bug.
func SyncBugFTS(id int64, title, bg, dp, rc, sol string) {
	DB.Exec("DELETE FROM bugs_fts WHERE rowid = ?", id)
	DB.Exec("INSERT INTO bugs_fts(rowid, title, background, debug_process, root_cause, solution) VALUES (?, ?, ?, ?, ?, ?)",
		id, title, bg, dp, rc, sol)
}

// SyncWikiFTS updates the FTS index for a single wiki.
func SyncWikiFTS(id int64, title, content string) {
	DB.Exec("DELETE FROM wikis_fts WHERE rowid = ?", id)
	DB.Exec("INSERT INTO wikis_fts(rowid, title, content) VALUES (?, ?, ?)",
		id, title, content)
}

// DeleteBugFTS removes a bug from the FTS index.
func DeleteBugFTS(id int64) {
	DB.Exec("DELETE FROM bugs_fts WHERE rowid = ?", id)
}

// DeleteWikiFTS removes a wiki from the FTS index.
func DeleteWikiFTS(id int64) {
	DB.Exec("DELETE FROM wikis_fts WHERE rowid = ?", id)
}

// migrateBugContent populates the content column from old separate fields.
func migrateBugContent() {
	rows, err := DB.Query("SELECT id, background, debug_process, root_cause, solution FROM bugs WHERE content = '' AND background != ''")
	if err != nil || rows == nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var bg, dp, rc, sol string
		if err := rows.Scan(&id, &bg, &dp, &rc, &sol); err != nil {
			continue
		}
		var sb strings.Builder
		sb.WriteString("## Background\n\n")
		sb.WriteString(bg)
		if dp != "" {
			sb.WriteString("\n\n## Debug Process\n\n")
			sb.WriteString(dp)
		}
		sb.WriteString("\n\n## Root Cause Analysis\n\n")
		sb.WriteString(rc)
		sb.WriteString("\n\n## Solution\n\n")
		sb.WriteString(sol)
		DB.Exec("UPDATE bugs SET content = ? WHERE id = ?", sb.String(), id)
	}
}
