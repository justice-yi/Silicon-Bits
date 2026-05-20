package handler

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"

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

	// Flat scan
	all := make(map[int64]*model.BSPModule)
	var roots []model.BSPModule
	for rows.Next() {
		var m model.BSPModule
		rows.Scan(&m.ID, &m.ParentID, &m.Name, &m.Slug, &m.Icon, &m.SortOrder, &m.BugCount, &m.WikiCount)
		all[m.ID] = &m
		if m.ParentID == nil {
			roots = append(roots, m)
		}
	}

	// Build tree
	for _, m := range all {
		if m.ParentID != nil {
			if parent, ok := all[*m.ParentID]; ok {
				parent.Children = append(parent.Children, *m)
			}
		}
	}

	// Sort children by sort_order then name (map iteration is unordered)
	for _, m := range all {
		sort.Slice(m.Children, func(i, j int) bool {
			if m.Children[i].SortOrder != m.Children[j].SortOrder {
				return m.Children[i].SortOrder < m.Children[j].SortOrder
			}
			return m.Children[i].Name < m.Children[j].Name
		})
	}

	// Convert roots (with children populated from map)
	var tree []model.BSPModule
	for _, r := range roots {
		if p, ok := all[r.ID]; ok {
			tree = append(tree, *p)
		}
	}

	c.JSON(http.StatusOK, tree)
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

	// Generate slug from name
	slug := req.Name

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
		setClauses = append(setClauses, "name = ?", "slug = ?")
		args = append(args, *req.Name, *req.Name)
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

