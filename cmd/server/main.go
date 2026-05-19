package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/config"
	"github.com/justice/silicon-bits/internal/database"
	"github.com/justice/silicon-bits/internal/router"
	"github.com/justice/silicon-bits/internal/wiki"
)

func main() {
	cfg := config.Load()

	log.Printf("Silicon Bits starting...")
	log.Printf("Database: %s", cfg.DBPath)

	if err := database.Init(cfg.DBPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Scan wiki directory for .md files on startup
	wikiDir := cfg.DataDir + "/wiki"
	if imported, err := wiki.ScanDirectory(wikiDir); err != nil {
		log.Printf("Wiki scan warning: %v", err)
	} else if imported > 0 {
		log.Printf("Wiki: imported %d new .md files from %s", imported, wikiDir)
		database.RebuildFTS()
	}
	log.Printf("Wiki directory: %s (drop .md files here)", wikiDir)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	router.Setup(r, cfg)

	// Serve frontend (embedded or static)
	webDir := "./web/dist"
	if _, err := os.Stat(webDir); err == nil {
		r.Static("/assets", webDir+"/assets")
			r.Static("/vditor", webDir+"/vditor")
		r.NoRoute(func(c *gin.Context) {
			c.File(webDir + "/index.html")
		})
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Listening on %s", addr)
	log.Printf("Auth: %s / ****", cfg.Username)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
