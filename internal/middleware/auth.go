package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/config"
)

func BasicAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, pass, ok := c.Request.BasicAuth()
		if !ok || user != cfg.Username || pass != cfg.Password {
			c.Header("WWW-Authenticate", `Basic realm="Silicon Bits"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
}
