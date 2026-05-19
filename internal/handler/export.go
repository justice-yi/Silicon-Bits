package handler

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// mdImageRegex matches ![alt](url) and [alt](pic/...) patterns in markdown
var mdImageRegex = regexp.MustCompile(`!?\[([^\]]*)\]\(([^)]+)\)`)

// isImageLikePath checks if a path looks like an image reference
func isImageLikePath(p string) bool {
	lower := strings.ToLower(p)
	exts := []string{".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}
	for _, ext := range exts {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// embedImages finds image references in markdown content and replaces them
// with base64 data URLs. wikiDir is the directory containing the wiki's .md file
// (for resolving relative paths like "pic/xxx.png").
func embedImages(content string, wikiDir string) string {
	return mdImageRegex.ReplaceAllStringFunc(content, func(match string) string {
		sub := mdImageRegex.FindStringSubmatch(match)
		if len(sub) < 3 {
			return match
		}
		alt := sub[1]
		path := sub[2]
		hasBang := strings.HasPrefix(match, "!")

		// Skip already-embedded data URLs
		if strings.HasPrefix(path, "data:") {
			return match
		}
		// Skip external URLs
		if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
			return match
		}
		// For links without !, only process if path looks like an image
		if !hasBang && !isImageLikePath(path) {
			return match
		}

		var filePath string

		// Absolute web path: /bugs/123/pic/xxx.png → data/bugs/123/pic/xxx.png
		if strings.HasPrefix(path, "/bugs/") || strings.HasPrefix(path, "/wiki/") || strings.HasPrefix(path, "/uploads/") {
			filePath = filepath.Join(dataDir, path)
		} else if wikiDir != "" {
			// Relative path: pic/09_UART/xxx.png → wikiDir/pic/09_UART/xxx.png
			filePath = filepath.Join(wikiDir, path)
		} else {
			return match
		}

		imgData, err := os.ReadFile(filePath)
		if err != nil {
			return match
		}

		mimeType := mimeTypeFromExt(filepath.Ext(path))
		b64 := base64.StdEncoding.EncodeToString(imgData)
		return "![" + alt + "](data:" + mimeType + ";base64," + b64 + ")"
	})
}

func mimeTypeFromExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	default:
		return "image/png"
	}
}
