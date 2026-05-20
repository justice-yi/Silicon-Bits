package wiki

import (
	"bufio"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/justice/silicon-bits/internal/database"
)

// WikiFile represents a parsed .md file with optional frontmatter.
type WikiFile struct {
	Title    string
	Category string
	Tags     []string
	Content  string
	FilePath string
}

// ParseFrontmatter extracts YAML frontmatter and content from markdown.
func ParseFrontmatter(data string) WikiFile {
	wf := WikiFile{Category: "other"}

	if !strings.HasPrefix(data, "---") {
		wf.Content = data
		return wf
	}

	scanner := bufio.NewScanner(strings.NewReader(data))
	scanner.Split(bufio.ScanLines)

	scanner.Scan() // Skip opening ---

	inFrontmatter := true
	var contentLines []string

	for scanner.Scan() {
		line := scanner.Text()

		if inFrontmatter {
			if strings.TrimSpace(line) == "---" {
				inFrontmatter = false
				continue
			}
			if idx := strings.Index(line, ":"); idx > 0 {
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])

				switch key {
				case "title":
					wf.Title = strings.Trim(val, "\"")
				case "category":
					wf.Category = strings.TrimSpace(val)
				case "tags":
					val = strings.TrimSpace(val)
					val = strings.TrimPrefix(val, "[")
					val = strings.TrimSuffix(val, "]")
					if val != "" {
						for _, t := range strings.Split(val, ",") {
							t = strings.TrimSpace(t)
							t = strings.Trim(t, "\"")
							if t != "" {
								wf.Tags = append(wf.Tags, t)
							}
						}
					}
				}
			}
		} else {
			contentLines = append(contentLines, line)
		}
	}

	wf.Content = strings.Join(contentLines, "\n")

	if wf.Title == "" {
		for _, line := range contentLines {
			if strings.HasPrefix(line, "# ") {
				wf.Title = strings.TrimPrefix(line, "# ")
				break
			}
		}
	}

	return wf
}

// ScanDirectory reads all .md files from wikiDir and syncs to SQLite.
func ScanDirectory(wikiDir string) (imported int, err error) {
	if err := os.MkdirAll(wikiDir, 0755); err != nil {
		return 0, fmt.Errorf("create wiki dir: %w", err)
	}

	entries, err := os.ReadDir(wikiDir)
	if err != nil {
		return 0, fmt.Errorf("read wiki dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			subDir := filepath.Join(wikiDir, entry.Name())
			filepath.WalkDir(subDir, func(path string, d os.DirEntry, err error) error {
				if err != nil || d.IsDir() {
					return nil
				}
				if strings.HasSuffix(d.Name(), ".md") {
					if importMD(wikiDir, path) {
						imported++
					}
				}
				return nil
			})
			continue
		}

		if !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		fp := filepath.Join(wikiDir, entry.Name())
		if importMD(wikiDir, fp) {
			imported++
		}
	}

	// Clean up SQLite records whose .md files no longer exist
	rows, err := database.DB.Query("SELECT id, file_path FROM wikis WHERE file_path != ''")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var fp string
			if rows.Scan(&id, &fp) == nil {
				if _, err := os.Stat(fp); os.IsNotExist(err) {
					database.DB.Exec("DELETE FROM wikis WHERE id = ?", id)
					database.DeleteWikiFTS(id)
					imported++
				}
			}
		}
	}

	return imported, nil
}

// importMD imports a single .md file if not already in DB.
// Also re-processes existing wikis that still have external image URLs.
func importMD(wikiDir string, fp string) bool {
	var existingID int64
	err := database.DB.QueryRow("SELECT id FROM wikis WHERE file_path = ?", fp).Scan(&existingID)
	if err == nil {
		// Already imported — skip (reprocessing external images is too slow at startup)
		return false
	}

	data, err := os.ReadFile(fp)
	if err != nil {
		return false
	}

	wf := ParseFrontmatter(string(data))
	if wf.Title == "" {
		wf.Title = strings.TrimSuffix(filepath.Base(fp), ".md")
	}
	wf.FilePath = fp

	// Download external images and replace URLs with local paths
	wf.Content = downloadExternalImages(fp, wf.Content)

	tagsJSON, _ := json.Marshal(wf.Tags)
	if wf.Tags == nil {
		tagsJSON = []byte("[]")
	}

	_, err = database.DB.Exec(
		`INSERT INTO wikis (title, category, tags, content, source, file_path)
		VALUES (?, ?, ?, ?, 'file', ?)`,
		wf.Title, wf.Category, string(tagsJSON), wf.Content, wf.FilePath,
	)
	if err != nil {
		return false
	}

	// Rewrite .md file with updated content (local image paths)
	writeContent(fp, wf.Title, wf.Category, wf.Tags, wf.Content)

	return true
}

// imgExtFromURL guesses file extension from URL path.
func imgExtFromURL(rawURL string) string {
	// Remove query string
	u := rawURL
	if idx := strings.Index(u, "?"); idx >= 0 {
		u = u[:idx]
	}
	ext := strings.ToLower(filepath.Ext(u))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".tiff", ".tif":
		return ext
	default:
		return ".png" // fallback
	}
}

// downloadExternalImages finds all external image URLs in markdown content,
// downloads them to pic/, and replaces URLs with local paths.
// Returns updated content.
func downloadExternalImages(mdPath string, content string) string {
	// Match ![alt](https://...)
	re := regexp.MustCompile(`!\[([^\]]*)\]\((https?://[^)]+)\)`)

	matches := re.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return content
	}

	// pic/ directory is next to the .md file
	picDir := filepath.Join(filepath.Dir(mdPath), "pic")
	os.MkdirAll(picDir, 0755)

	httpClient := &http.Client{Timeout: 10 * time.Second}

	// Process from end to start to preserve indices
	for i := len(matches) - 1; i >= 0; i-- {
		m := matches[i]
		fullStart, fullEnd := m[0], m[1]
		altStart, altEnd := m[2], m[3]
		urlStart, urlEnd := m[4], m[5]

		alt := content[altStart:altEnd]
		imgURL := content[urlStart:urlEnd]

		localPath, err := downloadImage(httpClient, picDir, imgURL)
		if err != nil {
			continue // skip failed downloads, keep original URL
		}

		replacement := fmt.Sprintf("![%s](%s)", alt, localPath)
		content = content[:fullStart] + replacement + content[fullEnd:]
	}

	return content
}

// downloadImage downloads an image URL to picDir and returns the relative path.
func downloadImage(client *http.Client, picDir string, imgURL string) (string, error) {
	resp, err := client.Get(imgURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	ext := imgExtFromURL(imgURL)

	// Use sha256 of URL as filename to avoid re-downloading
	hash := sha256.Sum256([]byte(imgURL))
	filename := fmt.Sprintf("%x%s", hash[:8], ext)
	destPath := filepath.Join(picDir, filename)

	// Already downloaded?
	if _, err := os.Stat(destPath); err == nil {
		return "pic/" + filename, nil
	}

	f, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	// Limit download size to 10MB
 limited := io.LimitReader(resp.Body, 10*1024*1024)
	if _, err := io.Copy(f, limited); err != nil {
		os.Remove(destPath)
		return "", err
	}

	return "pic/" + filename, nil
}

// WriteWikiFile writes a wiki as {title}/{title}.md with frontmatter.
func WriteWikiFile(wikiDir string, title string, category string, tags []string, content string) (string, error) {
	dirName := title
	dir := filepath.Join(wikiDir, dirName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	os.MkdirAll(filepath.Join(dir, "pic"), 0755)

	fp := filepath.Join(dir, dirName+".md")
	writeContent(fp, title, category, tags, content)
	return fp, nil
}

// WriteToPath writes content to an existing file path.
func WriteToPath(fp string, title string, category string, tags []string, content string) error {
	if err := os.MkdirAll(filepath.Dir(fp), 0755); err != nil {
		return err
	}
	writeContent(fp, title, category, tags, content)
	return nil
}

func writeContent(fp string, title string, category string, tags []string, content string) {
	tagsJSON, _ := json.Marshal(tags)
	tagsStr := strings.Trim(string(tagsJSON), "[]")
	tagsStr = strings.ReplaceAll(tagsStr, "\"", "")

	var sb strings.Builder
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("title: %s\n", title))
	sb.WriteString(fmt.Sprintf("category: %s\n", category))
	sb.WriteString(fmt.Sprintf("tags: [%s]\n", tagsStr))
	sb.WriteString("---\n\n")
	sb.WriteString(content)

	os.WriteFile(fp, []byte(sb.String()), 0644)
}
