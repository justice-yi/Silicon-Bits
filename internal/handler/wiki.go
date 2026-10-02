package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
	"github.com/justice/silicon-bits/internal/model"
	"github.com/justice/silicon-bits/internal/wiki"
)

var wikiDir string
var dataDir string

func SetWikiDir(dir string) {
	wikiDir = dir
}

func SetDataDir(dir string) {
	dataDir = dir
}

func GetDataDir() string {
	return dataDir
}

// ListWikis handles GET /api/wikis
func ListWikis(c *gin.Context) {
	f := model.WikiFilter{
		Category: c.Query("category"),
		Q:        c.Query("q"),
	}
	if m := c.Query("module"); m != "" {
		if id, err := strconv.ParseInt(m, 10, 64); err == nil {
			f.BSPModuleID = id
		}
	}
	if f.Page = queryInt(c, "page", 1); f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize = queryInt(c, "page_size", 20); f.PageSize < 1 || f.PageSize > 100 {
		f.PageSize = 20
	}

	var wikis []model.Wiki
	var total int

	if f.Q != "" {
		// Phrase-quote user input so MATCH can never hit a syntax error.
		safeQ := ftsQuote(f.Q)
		countQ := `SELECT COUNT(*) FROM wikis_fts WHERE wikis_fts MATCH ?`
		database.DB.QueryRow(countQ, safeQ).Scan(&total)

		dataQ := `SELECT w.id, w.title, w.category, w.tags, substr(w.content, 1, 200) as content, w.source, w.file_path, w.bsp_module_id, w.created_at, w.updated_at
			FROM wikis_fts f JOIN wikis w ON w.id = f.rowid
			WHERE wikis_fts MATCH ?
			ORDER BY rank
			LIMIT ? OFFSET ?`
		rows, err := database.DB.Query(dataQ, safeQ, f.PageSize, (f.Page-1)*f.PageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		wikis, err = scanWikis(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		query := `SELECT COUNT(*) FROM wikis WHERE 1=1`
		args := []any{}
		query, args = applyWikiFilters(query, args, f)
		database.DB.QueryRow(query, args...).Scan(&total)

		query = `SELECT id, title, category, tags, substr(content, 1, 200), source, file_path, bsp_module_id, created_at, updated_at FROM wikis WHERE 1=1`
		var dataArgs []any
		query, dataArgs = applyWikiFilters(query, dataArgs, f)
		query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
		dataArgs = append(dataArgs, f.PageSize, (f.Page-1)*f.PageSize)

		rows, err := database.DB.Query(query, dataArgs...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		wikis, err = scanWikis(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": wikis, "total": total, "page": f.Page, "page_size": f.PageSize})
}

// GetWiki handles GET /api/wikis/:id
func GetWiki(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var w model.Wiki
	var tagsStr string
	err := database.DB.QueryRow(
		`SELECT id, title, category, tags, content, source, file_path, bsp_module_id, created_at, updated_at
		FROM wikis WHERE id = ?`, id,
		).Scan(&w.ID, &w.Title, &w.Category, &tagsStr, &w.Content, &w.Source, &w.FilePath, &w.BSPModuleID, &w.CreatedAt, &w.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "wiki not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	json.Unmarshal([]byte(tagsStr), &w.Tags)

	// Only read from file when explicitly requested (edit page)
	if c.Query("source") == "file" && w.FilePath != "" {
		absFP := wiki.ResolveWikiPath(wikiDir, w.FilePath)
		if data, err := os.ReadFile(absFP); err == nil {
			wf := wiki.ParseFrontmatter(string(data))
			w.Content = wf.Content
			if wf.Title != "" {
				w.Title = wf.Title
			}
		}
		// Convert relative image URLs to absolute for editor rendering
		w.Content = wikiRelToAbsURLs(w.Content, absFP)
	}

	// Load linked bugs
	rows, _ := database.DB.Query(
		`SELECT b.id, b.title, b.severity, b.soc FROM bug_wiki_relations bw
		JOIN bugs b ON b.id = bw.bug_id WHERE bw.wiki_id = ?`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var rb model.BugBrief
			rows.Scan(&rb.ID, &rb.Title, &rb.Severity, &rb.SoC)
			w.LinkedBugs = append(w.LinkedBugs, rb)
		}
	}

	c.JSON(http.StatusOK, w)
}

// CreateWiki handles POST /api/wikis
func CreateWiki(c *gin.Context) {
	var req model.WikiCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Category == "" {
		req.Category = "other"
	}
	if err := wiki.SanitizeTitle(req.Title); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Duplicate titles are the root of the rename/delete corruption bugs:
	// reject them upfront instead of letting two rows fight over one path.
	if wikiTitleExists(0, req.Title) {
		c.JSON(http.StatusConflict, gin.H{"error": "an article with this title already exists"})
		return
	}
	// A leftover directory with the same name (e.g. orphaned pic/ dir from a
	// past failed delete) would silently absorb the new wiki's files.
	if _, err := os.Lstat(filepath.Join(wikiDir, req.Title)); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a directory with this title already exists"})
		return
	}
	if req.Source == "" {
		req.Source = "original"
	}
	tagsJSON, _ := json.Marshal(req.Tags)
	if req.Tags == nil {
		tagsJSON = []byte("[]")
	}

	// Write .md file
	fp, err := wiki.WriteWikiFile(wikiDir, req.Title, req.Category, req.Tags, req.Content)
	if err != nil {
		// Never insert a row without its file — the startup scan would delete
		// it and re-import churn would follow.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "write wiki file: " + err.Error()})
		return
	}

	if req.Source == "original" && fp != "" {
		req.Source = "file"
	}

	var id int64
	err = database.DB.QueryRow(
		`INSERT INTO wikis (title, category, bsp_module_id, tags, content, source, file_path)
		VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		req.Title, req.Category, req.BSPModuleID, string(tagsJSON), req.Content, req.Source,
		wiki.RelToWikiDir(wikiDir, fp),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.SyncWikiFTS(id, req.Title, req.Content)

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// UpdateWiki handles PUT /api/wikis/:id
func UpdateWiki(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req model.WikiUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current wiki for file update
	var currentFP, currentTitle, currentCategory string
	var currentTagsStr string
	database.DB.QueryRow("SELECT file_path, title, category, tags FROM wikis WHERE id = ?", id).
		Scan(&currentFP, &currentTitle, &currentCategory, &currentTagsStr)
	// file_path is stored relative to the wiki root; file ops need absolute.
	currentAbs := wiki.ResolveWikiPath(wikiDir, currentFP)

	var currentTags []string
	json.Unmarshal([]byte(currentTagsStr), &currentTags)

	// Determine new values
	newTitle := currentTitle
	newCategory := currentCategory
	newTags := currentTags
	newContent := ""

	if req.Title != nil {
		newTitle = *req.Title
	}
	if req.Category != nil {
		newCategory = *req.Category
	}
	if req.Tags != nil {
		newTags = req.Tags
	}

	setClauses := []string{}
	args := []any{}

	if req.Title != nil {
		setClauses = append(setClauses, "title = ?")
		args = append(args, *req.Title)
	}
	if req.Category != nil {
		setClauses = append(setClauses, "category = ?")
		args = append(args, *req.Category)
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		setClauses = append(setClauses, "tags = ?")
		args = append(args, string(tagsJSON))
	}
	if req.Content != nil {
		// Convert absolute image URLs back to relative for storage
		relContent := wikiAbsToRelURLs(*req.Content, currentAbs)
		setClauses = append(setClauses, "content = ?")
		args = append(args, relContent)
		newContent = relContent
	}
		if req.BSPModuleID != nil {
			setClauses = append(setClauses, "bsp_module_id = ?")
			args = append(args, *req.BSPModuleID)
		}

	if len(setClauses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	// Handle file rename if title changed
	newFPAbs := currentAbs
	titleChanged := req.Title != nil && *req.Title != currentTitle
	if titleChanged {
		if err := wiki.SanitizeTitle(newTitle); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if wikiTitleExists(id, newTitle) {
			c.JSON(http.StatusConflict, gin.H{"error": "an article with this title already exists"})
			return
		}
	}
	if titleChanged && currentAbs != "" {
		fp, err := wiki.RenameWikiFile(wikiDir, currentAbs, currentTitle, newTitle)
		if err != nil {
			if errors.Is(err, wiki.ErrPathExists) {
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "rename failed: " + err.Error()})
			}
			return
		}
		newFPAbs = fp
		setClauses = append(setClauses, "file_path = ?")
		args = append(args, wiki.RelToWikiDir(wikiDir, newFPAbs))
	}

	// Update .md file content
	if newContent != "" && newFPAbs != "" {
		wiki.WriteToPath(newFPAbs, newTitle, newCategory, newTags, newContent)
	} else if newFPAbs != "" {
		// Only title/category/tags changed — update frontmatter in-place
		if req.Title != nil || req.Category != nil || req.Tags != nil {
			wiki.UpdateFrontmatter(newFPAbs, newTitle, newCategory, newTags)
		}
	} else if newContent != "" {
		// Create file for wiki that didn't have one
		fp, _ := wiki.WriteWikiFile(wikiDir, newTitle, newCategory, newTags, newContent)
		if fp != "" {
			setClauses = append(setClauses, "file_path = ?")
			args = append(args, wiki.RelToWikiDir(wikiDir, fp))
		}
	}

	query := `UPDATE wikis SET ` + joinStrings(setClauses, ", ") + ` WHERE id = ?`
	args = append(args, id)

	result, err := database.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "wiki not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})

	// Sync FTS
	var wTitle, wContent string
	database.DB.QueryRow("SELECT title, content FROM wikis WHERE id = ?", id).Scan(&wTitle, &wContent)
	database.SyncWikiFTS(id, wTitle, wContent)
}

// DeleteWiki handles DELETE /api/wikis/:id
func DeleteWiki(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	// Get file path before deleting
	var fp string
	database.DB.QueryRow("SELECT file_path FROM wikis WHERE id = ?", id).Scan(&fp)

	result, err := database.DB.Exec("DELETE FROM wikis WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "wiki not found"})
		return
	}
	database.DeleteWikiFTS(id)

	// Delete wiki directory (contains .md and pic/)
	if fp != "" {
		absFP := wiki.ResolveWikiPath(wikiDir, fp)
		parentDir := filepath.Dir(absFP)
		wikiRootAbs, _ := filepath.Abs(wikiDir)
		parentAbs, _ := filepath.Abs(parentDir)
		if parentAbs != wikiRootAbs && strings.HasPrefix(parentAbs, wikiRootAbs+string(filepath.Separator)) {
			os.RemoveAll(parentAbs)
		} else {
			os.Remove(absFP)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ScanWikis handles POST /api/wikis/scan — scan wiki directory for new .md files
func ScanWikis(c *gin.Context) {
	imported, err := wiki.ScanDirectory(wikiDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if imported > 0 {
		database.RebuildFTS()
	}
	c.JSON(http.StatusOK, gin.H{"imported": imported, "wiki_dir": wikiDir})
}

// ExportWiki handles GET /api/wikis/:id/export
func ExportWiki(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	format := c.DefaultQuery("format", "md")

	var w model.Wiki
	var tagsStr string
	err := database.DB.QueryRow(
		`SELECT id, title, category, tags, content, source, file_path, created_at, updated_at
		FROM wikis WHERE id = ?`, id,
	).Scan(&w.ID, &w.Title, &w.Category, &tagsStr, &w.Content, &w.Source, &w.FilePath, &w.CreatedAt, &w.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "wiki not found"})
		return
	}
	json.Unmarshal([]byte(tagsStr), &w.Tags)

	// Resolve wiki directory for relative image paths
	wDir := ""
	if w.FilePath != "" {
		wDir = filepath.Dir(wiki.ResolveWikiPath(wikiDir, w.FilePath))
	} else {
		// Fallback: try data/wiki/{title}/
		candidate := filepath.Join(wikiDir, w.Title)
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			wDir = candidate
		}
	}

	md := "# " + w.Title + "\n\n"
	md += "- Category: " + w.Category + "\n"
	md += "- Source: " + w.Source + "\n"
	if len(w.Tags) > 0 {
		md += "- Tags: " + joinStrings(w.Tags, ", ") + "\n"
	}
	md += "- Created: " + w.CreatedAt.Format("2006-01-02 15:04:05") + "\n\n"
	md += embedImages(w.Content, wDir)

	if format == "md" {
		// Prefer the article title as the download name (UTF-8 encoded);
		// fall back to wiki-{id} for clients that ignore filename*.
		safeTitle := sanitizeFilename(w.Title)
		name := safeTitle
		if name == "" {
			name = "wiki-" + strconv.FormatInt(id, 10)
		}
		c.Header("Content-Disposition",
			"attachment; filename=\"wiki-"+strconv.FormatInt(id, 10)+".md\"; filename*=UTF-8''"+url.PathEscape(name)+".md")
		c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(md))
		return
	}
	c.JSON(http.StatusOK, gin.H{"markdown": md})
}

// sanitizeFilename replaces characters that are unsafe in download filenames.
func sanitizeFilename(name string) string {
	mapped := strings.Map(func(r rune) rune {
		if strings.ContainsRune(`\/:*?"<>|`, r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(name))
	return mapped
}

// --- helpers ---

func scanWikis(rows *sql.Rows) ([]model.Wiki, error) {
	var wikis []model.Wiki
	for rows.Next() {
		var w model.Wiki
		var tagsStr string
			rows.Scan(&w.ID, &w.Title, &w.Category, &tagsStr, &w.Content, &w.Source, &w.FilePath, &w.BSPModuleID, &w.CreatedAt, &w.UpdatedAt)
		json.Unmarshal([]byte(tagsStr), &w.Tags)
		wikis = append(wikis, w)
	}
	// Without this check, a failed query looks like "no results" instead of an error.
	return wikis, rows.Err()
}

func applyWikiFilters(query string, args []any, f model.WikiFilter) (string, []any) {
	if f.Category != "" {
		query += " AND category = ?"
		args = append(args, f.Category)
	}
	if f.BSPModuleID != 0 {
		query += " AND bsp_module_id = ?"
		args = append(args, f.BSPModuleID)
	}
	return query, args
}

// wikiTitleExists reports whether another wiki (excluding excludeID) already
// uses this exact title.
func wikiTitleExists(excludeID int64, title string) bool {
	var cnt int
	database.DB.QueryRow("SELECT COUNT(*) FROM wikis WHERE title = ? AND id != ?", title, excludeID).Scan(&cnt)
	return cnt > 0
}

// GetWikiDir returns the configured wiki directory
func GetWikiDir() string {
	return wikiDir
}

// wikiRelToAbsURLs converts relative image URLs (pic/xxx.png) to absolute URLs (/wiki/{dir}/pic/xxx.png)
func wikiRelToAbsURLs(content string, filePath string) string {
	if filePath == "" {
		return content
	}
	wikiAssetDir := filepath.Dir(filePath)
	wikiRootAbs, _ := filepath.Abs(wikiDir)
	dirAbs, _ := filepath.Abs(wikiAssetDir)
	relDir, err := filepath.Rel(wikiRootAbs, dirAbs)
	if err != nil {
		return content
	}
	prefix := "/wiki/" + relDir + "/"
	// Replace ](pic/ with ](/wiki/{relDir}/pic/
	return strings.ReplaceAll(content, "](pic/", "]("+prefix+"pic/")
}

// wikiAbsToRelURLs converts absolute image URLs back to relative for .md file storage
func wikiAbsToRelURLs(content string, filePath string) string {
	if filePath == "" {
		return content
	}
	wikiAssetDir := filepath.Dir(filePath)
	wikiRootAbs, _ := filepath.Abs(wikiDir)
	dirAbs, _ := filepath.Abs(wikiAssetDir)
	relDir, err := filepath.Rel(wikiRootAbs, dirAbs)
	if err != nil {
		return content
	}
	prefix := "/wiki/" + relDir + "/pic/"
	// Replace ](/wiki/{relDir}/pic/ with ](pic/
	return strings.ReplaceAll(content, "]("+prefix, "](pic/")
}
