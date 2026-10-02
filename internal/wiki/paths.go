package wiki

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/justice/silicon-bits/internal/database"
)

// Wikis used to store whatever path was computed at write time (absolute
// container paths like /data/wiki/x.md, or CWD-relative ones). Moving the
// data directory or deploying to another machine left every row pointing at
// nonexistent files — and the startup scan then deleted and re-imported all
// of them with fresh IDs. file_path now stores paths RELATIVE to the wiki
// root; ResolveWikiPath turns them back into absolute local paths.

// RelToWikiDir converts an absolute path inside the wiki root into the
// relative storage form. Paths outside the root are returned unchanged.
func RelToWikiDir(wikiDir, fp string) string {
	if fp == "" {
		return ""
	}
	rootAbs, err := filepath.Abs(wikiDir)
	if err != nil {
		return fp
	}
	fpAbs, err := filepath.Abs(fp)
	if err != nil {
		return fp
	}
	rel, err := filepath.Rel(rootAbs, fpAbs)
	if err != nil || strings.HasPrefix(rel, "..") {
		return fp
	}
	return filepath.ToSlash(rel)
}

// ResolveWikiPath turns a stored file_path (relative, or a legacy absolute
// path from an old deployment) into an absolute local path. It prefers
// candidates that exist on disk, so legacy values keep working until they
// are migrated to the relative form.
func ResolveWikiPath(wikiDir, stored string) string {
	if stored == "" {
		return ""
	}
	rootAbs, _ := filepath.Abs(wikiDir)

	if filepath.IsAbs(stored) {
		if _, err := os.Stat(stored); err == nil {
			return stored // legacy absolute path that still resolves locally
		}
	} else {
		cand := filepath.Join(rootAbs, stored)
		if _, err := os.Stat(cand); err == nil {
			return cand
		}
	}

	// Legacy path written under a different root/CWD: reuse the tail after
	// the last "<wiki root name>/" segment, e.g. /data/wiki/LCD/x.md → LCD/x.md.
	if tail := tailAfterWikiRoot(wikiDir, stored); tail != "" {
		cand := filepath.Join(rootAbs, tail)
		if _, err := os.Stat(cand); err == nil {
			return cand
		}
	}

	if filepath.IsAbs(stored) {
		return stored
	}
	return filepath.Join(rootAbs, stored)
}

func tailAfterWikiRoot(wikiDir, p string) string {
	marker := "/" + filepath.Base(filepath.ToSlash(filepath.Clean(wikiDir))) + "/"
	p = filepath.ToSlash(p)
	idx := strings.LastIndex(p, marker)
	if idx < 0 {
		return ""
	}
	return p[idx+len(marker):]
}

// MigrateFilePaths rewrites legacy absolute/CWD-relative file_path values in
// the wikis table into wiki-root-relative form. Runs at startup BEFORE the
// wiki scan — the scan's cleanup deletes rows whose files are missing, so
// legacy paths must be relocated first.
func MigrateFilePaths(wikiDir string) {
	rows, err := database.DB.Query("SELECT id, file_path FROM wikis WHERE file_path != ''")
	if err != nil {
		return
	}
	type upd struct {
		id  int64
		rel string
	}
	var updates []upd
	for rows.Next() {
		var id int64
		var fp string
		if rows.Scan(&id, &fp) != nil {
			continue
		}
		abs := ResolveWikiPath(wikiDir, fp)
		rel := RelToWikiDir(wikiDir, abs)
		if rel != fp {
			updates = append(updates, upd{id, rel})
		}
	}
	rows.Close()

	for _, u := range updates {
		database.DB.Exec("UPDATE wikis SET file_path = ? WHERE id = ?", u.rel, u.id)
	}
	if len(updates) > 0 {
		log.Printf("Wiki: migrated %d file_path values to wiki-root-relative form", len(updates))
	}
}
