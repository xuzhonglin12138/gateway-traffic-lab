# Traffic Mode Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix form selection behavior, add normal/continuous/stress request modes, and localize the app to Chinese.

**Architecture:** Keep the app as a static vanilla JavaScript page served by the existing Go server. Extract request configuration helpers into browser-compatible globals and CommonJS exports so Node tests can verify URL building and mode behavior without adding dependencies.

**Tech Stack:** Go 1.23 module, embedded static HTML/CSS/JS, browser Fetch API, Node built-in `node:test` for frontend helper tests.

---

### Task 1: Add Frontend Behavior Tests

**Files:**
- Create: `cmd/server/web/app.test.js`
- Modify: `cmd/server/web/app.js`

**Step 1: Write failing tests**

Create Node tests for:
- scenario presets only produce configuration and do not imply auto-run behavior
- `/api/echo` uses payload parameters correctly
- grouped routes preserve selected method/path
- continuous mode is marked as unbounded until stopped
- stress mode uses higher default concurrency/count

**Step 2: Run test to verify it fails**

Run: `node --test cmd/server/web/app.test.js`

Expected: failure because helpers are not exported or mode helpers do not exist yet.

### Task 2: Implement Request Mode Helpers

**Files:**
- Modify: `cmd/server/web/app.js`

**Step 1: Implement helpers**

Add pure helpers for default mode configs, URL generation, bounded/unbounded progress calculations, and request state reset.

**Step 2: Run focused frontend tests**

Run: `node --test cmd/server/web/app.test.js`

Expected: pass.

### Task 3: Update Chinese UI

**Files:**
- Modify: `cmd/server/web/index.html`
- Modify: `cmd/server/web/styles.css`
- Modify: `cmd/server/web/app.js`

**Step 1: Replace English copy**

Translate visible text to Chinese and restructure the page around three mode cards.

**Step 2: Wire events**

Mode cards fill the form and set the selected mode. Start button reads current form values. Stop button halts continuous and batch runs.

**Step 3: Run frontend tests**

Run: `node --test cmd/server/web/app.test.js`

Expected: pass.

### Task 4: Update Documentation

**Files:**
- Modify: `README.md`

**Step 1: Translate and update behavior docs**

Document the three modes and Rainbond gateway monitoring usage in Chinese.

### Task 5: Verify Project

**Commands:**
- `node --test cmd/server/web/app.test.js`
- `go test ./...`
- `go build ./...`
- `go vet ./...`

**Expected:** All pass, unless local Go toolchain is still broken. If Go commands fail due to local toolchain version mismatch, report the exact failure.
