package handler

import (
	"encoding/base64"
	"net/url"
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

		// Skip already-embedded data URLs
		if strings.HasPrefix(path, "data:") {
			return match
		}
		// Skip external URLs
		if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
			return match
		}
		// Only embed real image types. Other assets (e.g. .drawio XML) have no
		// meaningful data-URL representation — leave them as links.
		if !isImageLikePath(path) {
			return match
		}

		filePath := findContentFile(dataDir, wikiDir, path)
		if filePath == "" {
			return match
		}

		imgData, err := os.ReadFile(filePath)
		if err != nil {
			return match
		}

		mimeType := mimeTypeFromExt(filepath.Ext(filePath))
		b64 := base64.StdEncoding.EncodeToString(imgData)
		return "![" + alt + "](data:" + mimeType + ";base64," + b64 + ")"
	})
}

// findContentFile maps a markdown URL to a readable local file. Upload URLs
// are percent-encoded (PathEscape on Chinese/space titles), while the disk
// holds the raw names — try the raw path first, then the decoded one.
func findContentFile(dataDir, wikiDir, path string) string {
	candidates := []string{path}
	if dec, err := url.PathUnescape(path); err == nil && dec != path {
		candidates = append(candidates, dec)
	}
	for _, p := range candidates {
		if strings.HasPrefix(p, "/bugs/") || strings.HasPrefix(p, "/wiki/") || strings.HasPrefix(p, "/uploads/") {
			fp := filepath.Join(dataDir, p)
			if _, err := os.Stat(fp); err == nil {
				return fp
			}
		} else if wikiDir != "" && !strings.HasPrefix(p, "/") {
			fp := filepath.Join(wikiDir, p)
			if _, err := os.Stat(fp); err == nil {
				return fp
			}
		}
	}
	return ""
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
