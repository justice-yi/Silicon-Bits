package router

import (
	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/config"
	"github.com/justice/silicon-bits/internal/handler"
	"github.com/justice/silicon-bits/internal/middleware"
)

func Setup(r *gin.Engine, cfg *config.Config) {
	handler.SetWikiDir(cfg.DataDir + "/wiki")
	handler.SetDataDir(cfg.DataDir)

	// Static file serving (no auth required for embedded images)
	r.Static("/bugs", cfg.DataDir+"/bugs")
	r.Static("/wiki", cfg.DataDir+"/wiki")
	r.Static("/uploads", cfg.DataDir+"/uploads")

	// API routes — protected by Basic Auth
	api := r.Group("/api", middleware.BasicAuth(cfg))
	{
		// Stats
		api.GET("/stats", handler.Stats)

		// Bugs
		bugs := api.Group("/bugs")
		{
			bugs.GET("", handler.ListBugs)
			bugs.GET("/export", handler.ExportBug)
			bugs.POST("", handler.CreateBug)
			bugs.GET("/:id", handler.GetBug)
			bugs.PUT("/:id", handler.UpdateBug)
			bugs.DELETE("/:id", handler.DeleteBug)
			bugs.GET("/:id/export", handler.ExportBug)
			bugs.POST("/:id/links", handler.LinkWiki)
			bugs.DELETE("/:id/links/:target_id", handler.UnlinkWiki)
		}

		// Wikis
		wikis := api.Group("/wikis")
		{
			wikis.GET("", handler.ListWikis)
			wikis.POST("", handler.CreateWiki)
			wikis.POST("/scan", handler.ScanWikis)
			wikis.GET("/:id", handler.GetWiki)
			wikis.PUT("/:id", handler.UpdateWiki)
			wikis.DELETE("/:id", handler.DeleteWiki)
			wikis.GET("/:id/export", handler.ExportWiki)
		}

		// Upload
		api.POST("/upload", handler.UploadImage)
		api.POST("/upload-local", handler.UploadLocalFile)

		// Search
		api.GET("/search", handler.Search)

		// BSP Module Tree
		api.GET("/bsp/tree", handler.BSPTree)
			api.POST("/bsp/modules", handler.CreateBSPModule)
			api.PUT("/bsp/modules/:id", handler.UpdateBSPModule)
			api.DELETE("/bsp/modules/:id", handler.DeleteBSPModule)
	}
}
