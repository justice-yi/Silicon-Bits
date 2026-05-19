package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/config"
)

func BasicAuth(cfg *config.Config) gin.HandlerFunc {
	skip := os.Getenv("AUTH_SKIP") != ""

	return func(c *gin.Context) {
		if skip {
			c.Next()
			return
		}
		user, pass, ok := c.Request.BasicAuth()
		if !ok || user != cfg.Username || pass != cfg.Password {
			c.Header("WWW-Authenticate", `Basic realm="Silicon Bits"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
}
