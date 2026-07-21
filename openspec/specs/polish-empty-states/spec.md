# polish-empty-states Specification

## Purpose
TBD - created by archiving change add-mobile-pwa-and-polish. Update Purpose after archive.
## Requirements
### Requirement: Empty state components
The system SHALL render a friendly empty state (illustration + 1-line description + 1 CTA) on every primary list view when the dataset is empty.

#### Scenario: WHEN a user opens the Lists view with zero customer lists
THEN the page SHALL render an empty-state component showing: 📋 illustration, "Chưa có tệp khách hàng nào", and a "Tạo tệp đầu tiên" button that opens the CreateListModal.

#### Scenario: WHEN the same empty state is shown for 6 views (Lists / Broadcasts / Targets / Content Blocks / Pipeline Kanban / Journey Funnel)
THEN each SHALL have its own SVG illustration (no emoji as primary icon), tone in Vietnamese, and a CTA linking to the appropriate create action.

### Requirement: Loading skeletons
The system SHALL use a CSS shimmer skeleton (instead of spinner) while fetching data for the three busiest lists: Lists, Broadcasts, Inbox.

#### Scenario: WHEN the Lists view mounts and `/api/v1/lists` has not returned yet
THEN the view SHALL show 5 skeleton rows of fixed height matching the real row dimensions, with a subtle left-to-right shimmer animation (CSS `@keyframes`, 1.5s ease-in-out infinite).

#### Scenario: WHEN data arrives
THEN the skeletons SHALL disappear (replaced by real rows) without layout shift (use `min-height` on table).

### Requirement: Dark mode coverage for new marketing views
The system SHALL apply the existing dark-mode CSS variables to all marketing views added in Sprints 2-6 (Heatmap widget, AI Campaign Studio, Journey Funnel, Pipeline Kanban).

#### Scenario: WHEN dark mode is active and the user opens `/marketing/ai-studio`
THEN every card, input, button SHALL use `var(--bg-card)`, `var(--text-main)`, `var(--border-color)` tokens instead of hard-coded colors.

#### Scenario: WHEN the page is inspected for `prefers-color-scheme: dark`
THEN the computed background SHALL be darker than `#1e1e1e` (no white flash).

