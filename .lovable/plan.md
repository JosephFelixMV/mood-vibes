

## Plan: Add Automated Link Check Configuration to Site Configuration

### What
Move the automated link checker toggle and status display from the Product List page into the Configuration tab, presented as a dedicated card alongside the existing config sections.

### Changes

**1. Create `AutomatedLinkCheckConfig` component** (`src/components/admin/AutomatedLinkCheckConfig.tsx`)
- A standalone Card component containing:
  - Switch toggle for enabling/disabling the cron job (with confirmation dialog for disable)
  - Last batch check timestamp display
  - Frequency info (every 6 hours)
  - Auto-deactivation threshold info (3 consecutive failures)
- Reuses the same logic currently in ProductList (invoke `toggle-cron-job` edge function, query `cron-job-status`, query latest `last_checked_at`)

**2. Update `SiteConfiguration.tsx`**
- Import and render `AutomatedLinkCheckConfig` alongside CategoryVibeManager and existing config sections

**3. Update `ProductList.tsx`**
- Remove the cron toggle Switch, confirmation dialog, and related state (`cronActive`, `togglingCron`, `showCronConfirm`, `executeCronToggle`, `handleToggleCron`, cron status query)
- Keep the "last batch check" display as a read-only status indicator (or remove entirely since it's now in Configuration)

### Technical Details
- The new component queries `toggle-cron-job` GET for current status and POST to toggle
- Queries `products` table for `MAX(last_checked_at)` for the last run timestamp
- Uses `AlertDialog` for disable confirmation (same pattern as current)
- Uses `Switch` component and `@tanstack/react-query` for state management

