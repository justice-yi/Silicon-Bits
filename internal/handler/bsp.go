package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
	"github.com/justice/silicon-bits/internal/model"
)

// BSPTree handles GET /api/bsp/tree
func BSPTree(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT m.id, m.parent_id, m.name, m.slug, m.icon, m.sort_order,
		COALESCE((SELECT COUNT(*) FROM bugs WHERE bsp_module_id = m.id), 0) as bug_count,
		COALESCE((SELECT COUNT(*) FROM wikis WHERE bsp_module_id = m.id), 0) as wiki_count
		FROM bsp_modules m ORDER BY m.sort_order, m.name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	// Flat scan — group children by parent. Row order (ORDER BY sort_order,
	// name) is exactly the order children appear in, so assembly is
	// deterministic at every level.
	childrenOf := make(map[int64][]model.BSPModule)
	var roots []model.BSPModule
	for rows.Next() {
		var m model.BSPModule
		rows.Scan(&m.ID, &m.ParentID, &m.Name, &m.Slug, &m.Icon, &m.SortOrder, &m.BugCount, &m.WikiCount)
		if m.ParentID == nil {
			roots = append(roots, m)
		} else {
			childrenOf[*m.ParentID] = append(childrenOf[*m.ParentID], m)
		}
	}

	// Recursive assembly: a module's subtree is fully built before the copy
	// lands in its parent, at any depth. The previous map-iteration build
	// appended value copies in random order and could drop grandchildren.
	var build func(id int64) []model.BSPModule
	build = func(id int64) []model.BSPModule {
		kids := childrenOf[id]
		for i := range kids {
			kids[i].Children = build(kids[i].ID)
		}
		return kids
	}
	for i := range roots {
		roots[i].Children = build(roots[i].ID)
	}

	c.JSON(http.StatusOK, roots)
}

// CreateBSPModule handles POST /api/bsp/modules
func CreateBSPModule(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		ParentID *int64 `json:"parent_id"`
		Icon     string `json:"icon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Duplicate names make modules indistinguishable in the UI (the tree and
	// edit dropdowns show names only) — reject with a friendly error instead
	// of letting the raw UNIQUE constraint surface as a 500.
	if bspNameExists(0, req.Name) {
		c.JSON(http.StatusConflict, gin.H{"error": "a module with this name already exists"})
		return
	}

	slug := generateUniqueSlug(req.Name)

	var id int64
	err := database.DB.QueryRow(
		`INSERT INTO bsp_modules (name, slug, icon, parent_id)
		VALUES (?, ?, ?, ?) RETURNING id`,
		req.Name, slug, req.Icon, req.ParentID,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// UpdateBSPModule handles PUT /api/bsp/modules/:id
func UpdateBSPModule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req struct {
		Name *string `json:"name"`
		Icon *string `json:"icon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	setClauses := []string{}
	args := []any{}

	if req.Name != nil {
		// Only treat it as a rename when the name actually changes.
		var current string
		database.DB.QueryRow("SELECT name FROM bsp_modules WHERE id = ?", id).Scan(&current)
		if *req.Name == current {
			req.Name = nil
		} else {
			if bspNameExists(id, *req.Name) {
				c.JSON(http.StatusConflict, gin.H{"error": "a module with this name already exists"})
				return
			}
			setClauses = append(setClauses, "name = ?", "slug = ?")
			args = append(args, *req.Name, generateUniqueSlug(*req.Name))
		}
	}
	if req.Icon != nil {
		setClauses = append(setClauses, "icon = ?")
		args = append(args, *req.Icon)
	}

	if len(setClauses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	query := fmt.Sprintf("UPDATE bsp_modules SET %s WHERE id = ?", joinStrings(setClauses, ", "))
	args = append(args, id)

	result, err := database.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "module not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// bspNameExists reports whether another module (excluding excludeID) uses
// this exact name.
func bspNameExists(excludeID int64, name string) bool {
	var cnt int
	database.DB.QueryRow("SELECT COUNT(*) FROM bsp_modules WHERE name = ? AND id != ?", name, excludeID).Scan(&cnt)
	return cnt > 0
}

// generateUniqueSlug derives a collision-free slug from the module name.
// The slug column has a UNIQUE constraint and is not used anywhere except
// the DB, so it just has to be stable-ish and unique.
func generateUniqueSlug(name string) string {
	base := strings.ToLower(strings.TrimSpace(name))
	base = strings.Join(strings.Fields(base), "-")
	if base == "" {
		base = "module"
	}
	slug := base
	for i := 2; ; i++ {
		var cnt int
		database.DB.QueryRow("SELECT COUNT(*) FROM bsp_modules WHERE slug = ?", slug).Scan(&cnt)
		if cnt == 0 {
			return slug
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

// DeleteBSPModule handles DELETE /api/bsp/modules/:id
func DeleteBSPModule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	// Check if module has bugs or wikis
	var bugCount, wikiCount, childCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM bugs WHERE bsp_module_id = ?", id).Scan(&bugCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM wikis WHERE bsp_module_id = ?", id).Scan(&wikiCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM bsp_modules WHERE parent_id = ?", id).Scan(&childCount)

	if bugCount > 0 || wikiCount > 0 || childCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "cannot delete module with associated items",
			"bug_count":    bugCount,
			"wiki_count":   wikiCount,
			"child_count":  childCount,
		})
		return
	}

	result, err := database.DB.Exec("DELETE FROM bsp_modules WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "module not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

