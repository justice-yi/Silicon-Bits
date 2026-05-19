package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
	"github.com/justice/silicon-bits/internal/model"
)

// parseBugContent splits unified content by ## headers into FTS shadow columns.
func parseBugContent(content string) (bg, dp, rc, sol string) {
	sections := map[string]*string{
		"background":          &bg,
		"debug process":       &dp,
		"root cause analysis": &rc,
		"root cause":          &rc,
		"solution":            &sol,
	}

	lines := strings.Split(content, "\n")
	var current *string
	var buf strings.Builder

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "## ") {
			if current != nil {
				*current = strings.TrimSpace(buf.String())
			}
			buf.Reset()
			header := strings.ToLower(strings.TrimPrefix(trimmed, "## "))
			// Handle variants like "Root Cause Analysis" or "Root Cause"
			if s, ok := sections[header]; ok {
				current = s
			} else {
				// Try matching without trailing words
				for key, s := range sections {
					if strings.HasPrefix(header, key) {
						current = s
						break
					}
				}
				if current == nil {
					current = nil
				}
			}
		} else {
			if current != nil {
				buf.WriteString(line)
				buf.WriteString("\n")
			}
		}
	}
	if current != nil {
		*current = strings.TrimSpace(buf.String())
	}
	return
}

// ListBugs handles GET /api/bugs
func ListBugs(c *gin.Context) {
	f := model.BugFilter{
		Severity: c.Query("severity"),
		SoC:      c.Query("soc"),
		Q:        c.Query("q"),
	}
	if v := c.Query("module"); v != "" {
		id, _ := strconv.ParseInt(v, 10, 64)
		f.ModuleID = &id
	}
	if f.Page = queryInt(c, "page", 1); f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize = queryInt(c, "page_size", 20); f.PageSize < 1 || f.PageSize > 100 {
		f.PageSize = 20
	}

	var bugs []model.Bug
	var total int

	if f.Q != "" {
		// Use FTS5 search
		countQ := `SELECT COUNT(*) FROM bugs_fts WHERE bugs_fts MATCH ?`
		database.DB.QueryRow(countQ, f.Q).Scan(&total)

		dataQ := `SELECT b.id, b.title, b.bsp_module_id, b.severity, b.kernel_version, b.soc, b.tags, b.content, b.created_at, b.updated_at
			FROM bugs_fts f JOIN bugs b ON b.id = f.rowid
			WHERE bugs_fts MATCH ?
			ORDER BY rank
			LIMIT ? OFFSET ?`
		rows, err := database.DB.Query(dataQ, f.Q, f.PageSize, (f.Page-1)*f.PageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		bugs = scanBugs(rows)
	} else {
		// Regular listing with filters
		query := `SELECT COUNT(*) FROM bugs WHERE 1=1`
		args := []any{}
		query, args = applyBugFilters(query, args, f)
		database.DB.QueryRow(query, args...).Scan(&total)

		query = `SELECT id, title, bsp_module_id, severity, kernel_version, soc, tags, content, created_at, updated_at
			FROM bugs WHERE 1=1`
		var dataArgs []any
		query, dataArgs = applyBugFilters(query, dataArgs, f)
		query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
		dataArgs = append(dataArgs, f.PageSize, (f.Page-1)*f.PageSize)

		rows, err := database.DB.Query(query, dataArgs...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		bugs = scanBugs(rows)
	}

	// Enrich with module names
	for i := range bugs {
		enrichBugModule(&bugs[i])
	}

	c.JSON(http.StatusOK, gin.H{"data": bugs, "total": total, "page": f.Page, "page_size": f.PageSize})
}

// GetBug handles GET /api/bugs/:id
func GetBug(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var b model.Bug
	var tagsStr string
	err := database.DB.QueryRow(
		`SELECT id, title, bsp_module_id, severity, kernel_version, soc, tags, content, created_at, updated_at
		FROM bugs WHERE id = ?`, id,
	).Scan(&b.ID, &b.Title, &b.BspModuleID, &b.Severity, &b.KernelVersion, &b.SoC, &tagsStr, &b.Content, &b.CreatedAt, &b.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "bug not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	json.Unmarshal([]byte(tagsStr), &b.Tags)
	enrichBugModule(&b)

	// Load related bugs
	rows, _ := database.DB.Query(
		`SELECT b.id, b.title, b.severity, b.soc FROM bug_relations br
		JOIN bugs b ON b.id = br.related_bug_id WHERE br.bug_id = ?`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var rb model.BugBrief
			rows.Scan(&rb.ID, &rb.Title, &rb.Severity, &rb.SoC)
			b.RelatedBugs = append(b.RelatedBugs, rb)
		}
	}

	// Load linked wikis
	rows, _ = database.DB.Query(
		`SELECT w.id, w.title, w.category FROM bug_wiki_relations bw
		JOIN wikis w ON w.id = bw.wiki_id WHERE bw.bug_id = ?`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var w model.WikiBrief
			rows.Scan(&w.ID, &w.Title, &w.Category)
			b.LinkedWikis = append(b.LinkedWikis, w)
		}
	}

	c.JSON(http.StatusOK, b)
}

// CreateBug handles POST /api/bugs
func CreateBug(c *gin.Context) {
	var req model.BugCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Severity == "" {
		req.Severity = "major"
	}
	tagsJSON, _ := json.Marshal(req.Tags)
	if req.Tags == nil {
		tagsJSON = []byte("[]")
	}

	// Parse unified content into FTS shadow columns
	bg, dp, rc, sol := parseBugContent(req.Content)

	var id int64
	err := database.DB.QueryRow(
		`INSERT INTO bugs (title, bsp_module_id, severity, kernel_version, soc, tags,
			background, debug_process, root_cause, solution, content)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		req.Title, req.BspModuleID, req.Severity, req.KernelVersion, req.SoC, string(tagsJSON),
		bg, dp, rc, sol, req.Content,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.SyncBugFTS(id, req.Title, bg, dp, rc, sol)

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// UpdateBug handles PUT /api/bugs/:id
func UpdateBug(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req model.BugUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build dynamic SET clause
	setClauses := []string{}
	args := []any{}
	if req.Title != nil {
		setClauses = append(setClauses, "title = ?")
		args = append(args, *req.Title)
	}
	if req.BspModuleID != nil {
		setClauses = append(setClauses, "bsp_module_id = ?")
		args = append(args, *req.BspModuleID)
	}
	if req.Severity != nil {
		setClauses = append(setClauses, "severity = ?")
		args = append(args, *req.Severity)
	}
	if req.KernelVersion != nil {
		setClauses = append(setClauses, "kernel_version = ?")
		args = append(args, *req.KernelVersion)
	}
	if req.SoC != nil {
		setClauses = append(setClauses, "soc = ?")
		args = append(args, *req.SoC)
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		setClauses = append(setClauses, "tags = ?")
		args = append(args, string(tagsJSON))
	}
	if req.Content != nil {
		setClauses = append(setClauses, "content = ?")
		args = append(args, *req.Content)

		// Sync FTS shadow columns
		bg, dp, rc, sol := parseBugContent(*req.Content)
		setClauses = append(setClauses, "background = ?")
		args = append(args, bg)
		setClauses = append(setClauses, "debug_process = ?")
		args = append(args, dp)
		setClauses = append(setClauses, "root_cause = ?")
		args = append(args, rc)
		setClauses = append(setClauses, "solution = ?")
		args = append(args, sol)
	}

	if len(setClauses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	query := `UPDATE bugs SET ` + joinStrings(setClauses, ", ") + ` WHERE id = ?`
	args = append(args, id)

	result, err := database.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "bug not found"})
		return
	}

	// Sync FTS: read current fields after update
	var title, bg, dp, rc, sol string
	database.DB.QueryRow("SELECT title, background, debug_process, root_cause, solution FROM bugs WHERE id = ?", id).Scan(&title, &bg, &dp, &rc, &sol)
	database.SyncBugFTS(id, title, bg, dp, rc, sol)

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DeleteBug handles DELETE /api/bugs/:id
func DeleteBug(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	result, err := database.DB.Exec("DELETE FROM bugs WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "bug not found"})
		return
	}
	database.DeleteBugFTS(id)
	// Remove bug image directory
	os.RemoveAll(filepath.Join(dataDir, "bugs", strconv.FormatInt(id, 10)))
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// LinkWiki handles POST /api/bugs/:id/links
func LinkWiki(c *gin.Context) {
	bugID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var body struct {
		WikiID *int64 `json:"wiki_id"`
		BugID  *int64 `json:"bug_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.WikiID != nil {
		_, err := database.DB.Exec("INSERT OR IGNORE INTO bug_wiki_relations (bug_id, wiki_id) VALUES (?, ?)", bugID, *body.WikiID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if body.BugID != nil {
		_, err := database.DB.Exec("INSERT OR IGNORE INTO bug_relations (bug_id, related_bug_id) VALUES (?, ?)", bugID, *body.BugID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "linked"})
}

// UnlinkWiki handles DELETE /api/bugs/:id/links/:target_id
func UnlinkWiki(c *gin.Context) {
	bugID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	targetID, _ := strconv.ParseInt(c.Param("target_id"), 10, 64)
	linkType := c.Query("type") // "wiki" or "bug"

	if linkType == "wiki" {
		database.DB.Exec("DELETE FROM bug_wiki_relations WHERE bug_id = ? AND wiki_id = ?", bugID, targetID)
	} else {
		database.DB.Exec("DELETE FROM bug_relations WHERE bug_id = ? AND related_bug_id = ?", bugID, targetID)
	}
	c.JSON(http.StatusOK, gin.H{"message": "unlinked"})
}

// ExportBug handles GET /api/bugs/:id/export
func ExportBug(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	format := c.DefaultQuery("format", "md")

	var b model.Bug
	var tagsStr string
	err := database.DB.QueryRow(
		`SELECT id, title, bsp_module_id, severity, kernel_version, soc, tags, content, created_at, updated_at
		FROM bugs WHERE id = ?`, id,
	).Scan(&b.ID, &b.Title, &b.BspModuleID, &b.Severity, &b.KernelVersion, &b.SoC, &tagsStr, &b.Content, &b.CreatedAt, &b.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "bug not found"})
		return
	}
	json.Unmarshal([]byte(tagsStr), &b.Tags)

	var md string
	if b.Content != "" {
		md = "# " + b.Title + "\n\n"
		md += "- Severity: " + b.Severity + "\n"
		if b.KernelVersion != "" {
			md += "- Kernel: " + b.KernelVersion + "\n"
		}
		if b.SoC != "" {
			md += "- SoC: " + b.SoC + "\n"
		}
		if len(b.Tags) > 0 {
			md += "- Tags: " + joinStrings(b.Tags, ", ") + "\n"
		}
		md += "- Created: " + b.CreatedAt.Format("2006-01-02 15:04:05") + "\n\n"
		md += embedImages(b.Content, "")
	}

	if format == "md" {
		c.Header("Content-Disposition", "attachment; filename=bug-"+strconv.FormatInt(id, 10)+".md")
		c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(md))
		return
	}
	c.JSON(http.StatusOK, gin.H{"markdown": md})
}

// --- helpers ---

func scanBugs(rows *sql.Rows) []model.Bug {
	var bugs []model.Bug
	for rows.Next() {
		var b model.Bug
		var tagsStr string
		rows.Scan(&b.ID, &b.Title, &b.BspModuleID, &b.Severity, &b.KernelVersion, &b.SoC, &tagsStr, &b.Content, &b.CreatedAt, &b.UpdatedAt)
		json.Unmarshal([]byte(tagsStr), &b.Tags)
		bugs = append(bugs, b)
	}
	return bugs
}

func enrichBugModule(b *model.Bug) {
	if b.BspModuleID == nil {
		return
	}
	var name string
	var slug string
	var parentID *int64
	database.DB.QueryRow("SELECT name, slug, parent_id FROM bsp_modules WHERE id = ?", *b.BspModuleID).Scan(&name, &slug, &parentID)
	b.BspModuleName = name
	if parentID != nil {
		var parentName string
		database.DB.QueryRow("SELECT name FROM bsp_modules WHERE id = ?", *parentID).Scan(&parentName)
		b.BspModulePath = parentName + " > " + name
	} else {
		b.BspModulePath = name
	}
}

func applyBugFilters(query string, args []any, f model.BugFilter) (string, []any) {
	if f.ModuleID != nil {
		query += " AND bsp_module_id = ?"
		args = append(args, *f.ModuleID)
	}
	if f.Severity != "" {
		query += " AND severity = ?"
		args = append(args, f.Severity)
	}
	if f.SoC != "" {
		query += " AND soc = ?"
		args = append(args, f.SoC)
	}
	return query, args
}

func queryInt(c *gin.Context, key string, def int) int {
	v, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return def
	}
	return v
}

func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for _, s := range ss[1:] {
		result += sep + s
	}
	return result
}
