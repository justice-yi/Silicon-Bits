package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/justice/silicon-bits/internal/database"
)

var allowedExts = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".webp": true, ".svg": true, ".bmp": true, ".ico": true,
	".avif": true, ".tiff": true, ".tif": true,
}

func isImageExt(ext string) bool {
	return allowedExts[ext]
}

func detectMIME(file io.Reader, ext string) (string, []byte, error) {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return "", nil, err
	}
	contentType := http.DetectContentType(buf[:n])
	if strings.HasPrefix(contentType, "image/") || ext == ".svg" {
		return contentType, buf[:n], nil
	}
	return "", nil, fmt.Errorf("not an image")
}

// UploadImage handles POST /api/upload
func UploadImage(c *gin.Context) {
	articleType := c.PostForm("type")
	articleID := c.PostForm("id")

	if articleType == "" || articleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type and id are required"})
		return
	}
	if articleType != "bug" && articleType != "wiki" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'bug' or 'wiki'"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isImageExt(ext) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}
	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 10MB)"})
		return
	}

	_, head, err := detectMIME(file, ext)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is not an image"})
		return
	}

	if articleType == "bug" {
		uploadBugImageFile(c, articleID, header.Filename, ext, head, file)
	} else {
		uploadWikiImageFile(c, articleID, header.Filename, ext, head, file)
	}
}

// UploadLocalFile handles POST /api/upload-local
func UploadLocalFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
		Type string `json:"type"`
		ID   string `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Path == "" || req.Type == "" || req.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path, type and id are required"})
		return
	}
	if req.Type != "bug" && req.Type != "wiki" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'bug' or 'wiki'"})
		return
	}

	filePath := req.Path
	if strings.HasPrefix(filePath, "file://") {
		filePath = filePath[7:]
	}
	if strings.Contains(filePath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	if !isImageExt(ext) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}

	src, err := os.Open(filePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read file: " + err.Error()})
		return
	}
	defer src.Close()

	_, head, err := detectMIME(src, ext)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is not an image"})
		return
	}

	origName := filepath.Base(filePath)
	if req.Type == "bug" {
		uploadBugImageFile(c, req.ID, origName, ext, head, src)
	} else {
		uploadWikiImageFile(c, req.ID, origName, ext, head, src)
	}
}

// uploadBugImageFile saves a bug image to data/bugs/{bugID}/pic/
func uploadBugImageFile(c *gin.Context, bugID string, origName string, ext string, head []byte, rest io.Reader) {
	picDir := filepath.Join(GetDataDir(), "bugs", bugID, "pic")
	if err := os.MkdirAll(picDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create pic directory"})
		return
	}

	b := make([]byte, 8)
	rand.Read(b)
	filename := hex.EncodeToString(b) + ext
	destPath := filepath.Join(picDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	defer dst.Close()

	dst.Write(head)
	io.Copy(dst, rest)

	c.JSON(http.StatusCreated, gin.H{
		"url":      fmt.Sprintf("/bugs/%s/pic/%s", bugID, filename),
		"filename": origName,
	})
}

// uploadWikiImageFile saves a wiki image to data/wiki/{wiki_dir}/pic/
func uploadWikiImageFile(c *gin.Context, wikiID string, origName string, ext string, head []byte, rest io.Reader) {
	wikiDir := getWikiAssetDir(wikiID)
	picDir := filepath.Join(wikiDir, "pic")
	if err := os.MkdirAll(picDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create pic directory"})
		return
	}

	b := make([]byte, 8)
	rand.Read(b)
	filename := hex.EncodeToString(b) + ext
	destPath := filepath.Join(picDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	defer dst.Close()

	dst.Write(head)
	io.Copy(dst, rest)

	c.JSON(http.StatusCreated, gin.H{
		"url":      "pic/" + filename,
		"filename": origName,
	})
}

// getWikiAssetDir returns the directory containing the wiki's .md file
func getWikiAssetDir(wikiID string) string {
	var fp string
	err := database.DB.QueryRow("SELECT file_path FROM wikis WHERE id = ?", wikiID).Scan(&fp)
	if err == nil && fp != "" {
		return filepath.Dir(fp)
	}
	var title string
	database.DB.QueryRow("SELECT title FROM wikis WHERE id = ?", wikiID).Scan(&title)
	if title == "" {
		title = "wiki_" + wikiID
	}
	return filepath.Join(GetWikiDir(), title)
}
