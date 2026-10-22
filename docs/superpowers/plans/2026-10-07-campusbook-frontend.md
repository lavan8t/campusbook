# CampusBook Minimal Flat UI Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CampusBook frontend into a clean, flat, academic-grade UI with Roboto Flex, vibrant Material 3 color palette, integrated staff booking workflow (with start-now toggle and duration presets), and GSAP-animated React Flow relational schema.

**Architecture:** Next.js App Router (client-side only interactive engine). Pure TypeScript relational division and GiST temporal range collision evaluator. React Flow ER diagram canvas with dynamic node highlights. Material Web Components (@m3e/web) themed with vibrant palette, with native date/time and duration quick-selectors.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, @xyflow/react 12, GSAP 3.15, @m3e/web 2.9, Roboto Flex (next/font/google).

## Global Constraints

- Runtime & package manager: bun exclusively (`bun run build`, `bun test`). Never use npm/yarn/pnpm.
- Git commits after verified completion of each task. Never push or rebase.
- Surgical edits only.
- Strict minimal flat UI: zero drop shadows, zero box shadows, zero gradients, 0px-4px border radius.
- Google Font Roboto Flex applied across all UI elements.
- M3 theme palette: `variant="vibrant"` swatch.

---

### Task 1: Typography and Global Flat Theme Configuration

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Next.js Google font loader `next/font/google`.
- Produces: Global CSS variables, flat borders `#E2E8F0` / `#CBD5E1`, surface `#F8FAFC`, background `#FFFFFF`, text `#0F172A`, Roboto Flex font family.

- [ ] **Step 1: Update app/layout.tsx to load Roboto Flex**
Load `Roboto_Flex` with latin subset and configure metadata.

- [ ] **Step 2: Update app/globals.css with clean flat variables and zero shadow overrides**
Remove all glow/box-shadow rules, configure flat borders, high data density, and table card styles.

- [ ] **Step 3: Verify build**
Run: `bun run build`
Expected: PASS with no font or css errors.

- [ ] **Step 4: Commit**
```bash
git add app/layout.tsx app/globals.css
git commit -m "style: configure roboto flex and minimal flat theme variables"
```

---

### Task 2: Type Definitions and M3E Web Components Extension

**Files:**
- Modify: `src/types/m3e.d.ts`

**Interfaces:**
- Consumes: @m3e/web custom element declarations.
- Produces: JSX types for `m3e-theme`, `m3e-select`, `m3e-option`, `m3e-button`, `m3e-switch`, `m3e-date-input`, `m3e-datepicker`.

- [ ] **Step 1: Declare M3E elements in src/types/m3e.d.ts**
Add declarations for `m3e-switch`, `m3e-date-input`, `m3e-datepicker` and `m3e-timepicker`.

- [ ] **Step 2: Verify type checking**
Run: `bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/types/m3e.d.ts
git commit -m "types: declare additional m3e web components"
```

---

### Task 3: TableNode Component Modernization & Flat Schema Visuals

**Files:**
- Modify: `src/components/TableNode.tsx`

**Interfaces:**
- Consumes: `TableNodeData` from `src/components/TableNode.tsx`.
- Produces: Flat card with 1px solid border `#CBD5E1`, sharp corners (2px), PK/FK badge indicators, and compact tuple rows with data attributes for GSAP targeting.

- [ ] **Step 1: Refactor TableNode.tsx for minimal flat styling**
Eliminate rounded pill borders, set crisp 2px border radius, clear table headers with uppercase mono font, and distinct row borders.

- [ ] **Step 2: Verify build**
Run: `bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/components/TableNode.tsx
git commit -m "refactor: apply minimal flat design to TableNode component"
```

---

### Task 4: Interactive Staff-Centric Booking Controls and Vibrant Palette

**Files:**
- Modify: `app/page.tsx`
- Modify: `src/lib/animations.ts`

**Interfaces:**
- Consumes: `dbEngine.ts`, `schema.ts`, `animations.ts`.
- Produces: Staff UX flow:
  - User name selector with role tag.
  - Equipment selector with location tag.
  - "Start Now" switch toggle (auto-stamps current local ISO time).
  - Quick return duration buttons (+30m, +1h, +2h, +4h, custom).
  - Vibrant M3 theme swatch (`variant="vibrant"`).
  - Clean split layout: 38% control desk / console, 62% React Flow schema canvas.
  - GSAP animated traversal on verify and booking insert.

- [ ] **Step 1: Update animations.ts for sharp flat stroke transitions**
Ensure GSAP timeline smoothly animates edges to `#16A34A` on success and `#DC2626` on failure, with crisp 3px horizontal shake on failing qualification nodes.

- [ ] **Step 2: Implement intuitive staff UI in app/page.tsx**
Add "Start Now" checkbox/toggle, duration buttons, select dropdown styling with vibrant theme container, and detailed SQL log output.

- [ ] **Step 3: Verify build and test bundle**
Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add app/page.tsx src/lib/animations.ts
git commit -m "feat: implement staff booking workflow and vibrant flat theme"
```
