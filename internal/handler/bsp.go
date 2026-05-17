package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
	"github.com/justice/silicon-bits/internal/model"
)

// BSPTree handles GET /api/bsp/tree
func BSPTree(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT m.id, m.parent_id, m.name, m.slug, m.icon, m.sort_order,
		COALESCE((SELECT COUNT(*) FROM bugs WHERE bsp_module_id = m.id), 0) as bug_count
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
		rows.Scan(&m.ID, &m.ParentID, &m.Name, &m.Slug, &m.Icon, &m.SortOrder, &m.BugCount)
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

	// Convert roots (with children populated from map)
	var tree []model.BSPModule
	for _, r := range roots {
		if p, ok := all[r.ID]; ok {
			tree = append(tree, *p)
		}
	}

	c.JSON(http.StatusOK, tree)
}
