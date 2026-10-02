package wiki

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

// ErrPathExists is returned when a rename target path is already occupied.
var ErrPathExists = errors.New("target path already exists")

// SanitizeTitle validates a wiki title before it is used as a file/directory name.
func SanitizeTitle(title string) error {
	t := strings.TrimSpace(title)
	switch {
	case t == "":
		return fmt.Errorf("title must not be empty")
	case strings.ContainsAny(t, `/\`):
		return fmt.Errorf(`title must not contain path separators / or \`)
	case t == "." || t == "..":
		return fmt.Errorf("title must not be . or ..")
	case strings.ContainsAny(t, `:*?"<>|`):
		return fmt.Errorf(`title must not contain reserved characters : * ? " < > |`)
	}
	if strings.ContainsFunc(t, unicode.IsControl) {
		return fmt.Errorf("title must not contain control characters")
	}
	return nil
}

// RenameWikiFile renames a wiki's .md file (and its dedicated directory if it
// has one) to match a new title, returning the new file path. Three layouts:
//   - dedicated dir "wiki/{title}/{title}.md" (created by the UI): rename dir + file
//   - shared dir (e.g. imported "wiki/LCD/01_x.md"): rename the file in place
//   - flat file "wiki/x.md": rename the file in place
//
// On any error the caller must abort the DB update — letting file_path and the
// filesystem diverge gets the row deleted by the next startup scan.
func RenameWikiFile(wikiDir, currentFP, currentTitle, newTitle string) (string, error) {
	dir := filepath.Dir(currentFP)
	wikiAbs, _ := filepath.Abs(wikiDir)
	dirAbs, _ := filepath.Abs(dir)

	// Dedicated self-titled directory: safe to rename the whole directory
	// (pic/ follows). Only when the dir is named after the title — never touch
	// a shared directory like "LCD/" that holds other wikis' files.
	if dirAbs != wikiAbs && filepath.Base(dir) == currentTitle {
		newDir := filepath.Join(wikiDir, newTitle)
		if _, err := os.Lstat(newDir); err == nil {
			return "", fmt.Errorf("%w: directory %s", ErrPathExists, newTitle)
		}
		if err := os.Rename(dir, newDir); err != nil {
			return "", fmt.Errorf("rename directory: %w", err)
		}
		oldMD := filepath.Join(newDir, currentTitle+".md")
		if _, err := os.Lstat(oldMD); err == nil {
			newMD := filepath.Join(newDir, newTitle+".md")
			if err := os.Rename(oldMD, newMD); err != nil {
				return "", fmt.Errorf("rename file: %w", err)
			}
			return newMD, nil
		}
		return filepath.Join(newDir, filepath.Base(currentFP)), nil
	}

	// Flat or shared-directory layout: rename the .md file in place.
	newFP := filepath.Join(dir, newTitle+".md")
	if newFP != currentFP {
		if _, err := os.Lstat(newFP); err == nil {
			return "", fmt.Errorf("%w: file %s.md", ErrPathExists, newTitle)
		}
		if err := os.Rename(currentFP, newFP); err != nil {
			return "", fmt.Errorf("rename file: %w", err)
		}
	}
	return newFP, nil
}
