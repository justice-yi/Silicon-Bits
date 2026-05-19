package model

import "time"

type Wiki struct {
	ID           int64     `json:"id"`
	Title        string    `json:"title"`
	Category     string    `json:"category"`
	BSPModuleID  *int64    `json:"bsp_module_id,omitempty"`
	BSPModuleName string   `json:"bsp_module_name,omitempty"`
	Tags         []string  `json:"tags"`
	Content      string    `json:"content"`
	Source       string    `json:"source"`
	FilePath     string    `json:"file_path,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	// Joined data
	LinkedBugs []BugBrief `json:"linked_bugs,omitempty"`
}

type WikiBrief struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Category string `json:"category"`
}

type WikiCreate struct {
	Title       string   `json:"title" binding:"required"`
	Category    string   `json:"category"`
	BSPModuleID *int64   `json:"bsp_module_id"`
	Tags        []string `json:"tags"`
	Content     string   `json:"content" binding:"required"`
	Source      string   `json:"source"`
}

type WikiUpdate struct {
	Title       *string  `json:"title"`
	Category    *string  `json:"category"`
	BSPModuleID *int64   `json:"bsp_module_id"`
	Tags        []string `json:"tags"`
	Content     *string  `json:"content"`
}

type WikiFilter struct {
	Category    string `form:"category"`
	BSPModuleID int64  `form:"module"`
	Q           string `form:"q"`
	Page        int    `form:"page"`
	PageSize    int    `form:"page_size"`
}
