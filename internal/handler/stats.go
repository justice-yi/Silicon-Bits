package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
)

// Stats handles GET /api/stats — returns counts for the footer
func Stats(c *gin.Context) {
	var bugCount, wikiCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM bugs").Scan(&bugCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM wikis").Scan(&wikiCount)
	c.JSON(http.StatusOK, gin.H{"bugs": bugCount, "wikis": wikiCount})
}
