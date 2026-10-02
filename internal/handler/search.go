package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
)

// Search handles GET /api/search?q=&type=all
func Search(c *gin.Context) {
	q := c.Query("q")
	searchType := c.DefaultQuery("type", "all")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	result := gin.H{"query": q}

	if searchType == "all" || searchType == "bug" {
		bugs, err := searchBugs(q)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		result["bugs"] = bugs
	}

	if searchType == "all" || searchType == "wiki" {
		wikis, err := searchWikis(q)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		result["wikis"] = wikis
	}

	c.JSON(http.StatusOK, result)
}

func searchBugs(q string) ([]map[string]any, error) {
	query := `SELECT b.id, b.title, b.severity, b.soc, snippet(bugs_fts, 2, '>>>', '<<<', '...', 30) as context
		FROM bugs_fts f JOIN bugs b ON b.id = f.rowid
		WHERE bugs_fts MATCH ? ORDER BY rank LIMIT 10`
	rows, err := database.DB.Query(query, ftsQuote(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var id int64
		var title, severity, soc, context string
		rows.Scan(&id, &title, &severity, &soc, &context)
		results = append(results, map[string]any{
			"id":       id,
			"title":    title,
			"severity": severity,
			"soc":      soc,
			"context":  context,
		})
	}
	return results, rows.Err()
}

func searchWikis(q string) ([]map[string]any, error) {
	query := `SELECT w.id, w.title, w.category, snippet(wikis_fts, 1, '>>>', '<<<', '...', 30) as context
		FROM wikis_fts f JOIN wikis w ON w.id = f.rowid
		WHERE wikis_fts MATCH ? ORDER BY rank LIMIT 10`
	rows, err := database.DB.Query(query, ftsQuote(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var id int64
		var title, category, context string
		rows.Scan(&id, &title, &category, &context)
		results = append(results, map[string]any{
			"id":       id,
			"title":    title,
			"category": category,
			"context":  context,
		})
	}
	return results, rows.Err()
}
