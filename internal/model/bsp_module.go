package model

type BSPModule struct {
	ID        int64        `json:"id"`
	ParentID  *int64       `json:"parent_id,omitempty"`
	Name      string       `json:"name"`
	Slug      string       `json:"slug"`
	Icon      string       `json:"icon"`
	SortOrder int          `json:"sort_order"`
	Children  []BSPModule  `json:"children,omitempty"`
	BugCount  int          `json:"bug_count"`
	WikiCount int          `json:"wiki_count"`
}
