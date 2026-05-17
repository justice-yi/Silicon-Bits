package model

import "time"

type Bug struct {
	ID            int64     `json:"id"`
	Title         string    `json:"title"`
	BspModuleID   *int64    `json:"bsp_module_id,omitempty"`
	BspModuleName string    `json:"bsp_module_name,omitempty"`
	BspModulePath string    `json:"bsp_module_path,omitempty"`
	Severity      string    `json:"severity"`
	KernelVersion string    `json:"kernel_version,omitempty"`
	SoC           string    `json:"soc,omitempty"`
	Tags          []string  `json:"tags"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Joined data
	RelatedBugs []BugBrief `json:"related_bugs,omitempty"`
	LinkedWikis []WikiBrief `json:"linked_wikis,omitempty"`
}

type BugBrief struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Severity string `json:"severity"`
	SoC      string `json:"soc,omitempty"`
}

type BugCreate struct {
	Title         string   `json:"title" binding:"required"`
	BspModuleID   *int64   `json:"bsp_module_id"`
	Severity      string   `json:"severity"`
	KernelVersion string   `json:"kernel_version"`
	SoC           string   `json:"soc"`
	Tags          []string `json:"tags"`
	Content       string   `json:"content" binding:"required"`
}

type BugUpdate struct {
	Title         *string  `json:"title"`
	BspModuleID   *int64   `json:"bsp_module_id"`
	Severity      *string  `json:"severity"`
	KernelVersion *string  `json:"kernel_version"`
	SoC           *string  `json:"soc"`
	Tags          []string `json:"tags"`
	Content       *string  `json:"content"`
}

type BugFilter struct {
	ModuleID  *int64  `form:"module"`
	Severity  string  `form:"severity"`
	SoC       string  `form:"soc"`
	Q         string  `form:"q"`
	Page      int     `form:"page"`
	PageSize  int     `form:"page_size"`
}
