# COMO - Early Task In Order With Timer & Batcher Dashboard

A Tampermonkey userscript for the Amazon Fresh COMO Operations Dashboard that helps dispatchers manage batching tasks, associates, deadlines, and cart actions more efficiently.

---

## What It Does

### ⏰ Early Task In Order

Automatically keeps tasks organized by **Batch Target time**.

The earliest deadline always gets priority so dispatchers can focus on the carts that need attention first.

Tasks that are overdue or approaching their Batch Target are visually highlighted.

- 🟢 Enough time remaining
- 🟡 Getting close to Batch Target
- 🔴 Overdue

---

### ⏱ Time Left Column

Adds a live **Time Left** column next to Batch Target on normal task rows.

The countdown updates automatically so you can immediately see how much time remains before a task's deadline.

- 🟢 Green → more than 10 minutes left
- 🟡 Yellow → under 10 minutes
- 🔴 Red → overdue

Problem Solve, Partially Batched, and Staged for Pickup are excluded from the normal Time Left task logic.

---

## 🦺 Batcher Timer Dashboard

Adds a live **Batcher Timers** dashboard above the Utilization section.

The panel tracks associate batching activity and performance.

### Dashboard Tabs

- **Live** — currently active batchers with elapsed time and bags/min
- **Today** — today's batcher performance
- **Weekly** — 7-day aggregated performance
- **Fastest** — top qualifying batching performances
- **Names** — associate name lookup

The panel also includes associate search.

---

## 📊 Live Dashboard Stats

The top of the Batcher Timer panel shows:

### 🦺 Batchers
Number of associates currently batching normal tasks.

### 👥 Recommended
Recommended minimum number of batchers based on the current task workload, Batch Targets, cart count, and time remaining.

The recommendation planning cycle updates at **:55 each hour**.

The recommendation is designed around task deadlines instead of individual associate speed.

### 📦 Remaining
Total remaining batching package workload.

### ⚡ Fast Reload

Batchers, Recommended, and Remaining are optimized to appear quickly after a page reload.

Recent same-cycle values can display immediately while the fresh dashboard data loads in the background.

The script avoids unnecessary repeated requests and heavy page scanning to reduce website lag.

---

# ▶ Run - Cart Actions

Press **▶ Run** to access dispatcher cart tools.

Each action is independent and performs only the action selected.

---

## ▶ Assign Cart

Allows a dispatcher to select one or multiple associates and automatically assign tasks to them.

Associates are assigned in the exact order selected.

Example:

1. Associate #1
2. Associate #2
3. Associate #3

The first associate receives the highest-priority eligible task, then the second associate receives the next one.

### Assignment Priority

Tasks are assigned using this order:

1. **Earliest Batch Target**
2. If multiple tasks have the same Batch Target → **most packages first**
3. If the Batch Target and package count are both the same → **task displayed higher on the dashboard first**

Example:

| Batch Target | Packages | Priority |
|---|---:|---:|
| 9:50 PM | 30 | 1 |
| 10:00 PM | 59 | 2 |
| 10:00 PM | 41 | 3 |
| 10:00 PM | 25 | 4 |

The **9:50 PM task always comes first**, even though the 10:00 PM task has more packages.

Package count is only used when Batch Targets are identical.

### Eligible Task Rules

The Assign Cart feature uses these rules:

| Associate Name | Cart/s | Action |
|---|---|---|
| Blank / ASSIGNABLE | Blank | ✅ Try |
| Associate name | Blank | ✅ Try |
| Blank / ASSIGNABLE | Cart present | ✅ Try |
| Associate name | Cart present | ⛔ Skip |

If one task rejects an assignment, the script keeps the **same associate** and tries the next eligible task.

It does not advance to the next selected associate until the current associate has been assigned or there are no eligible tasks remaining.

Assignments happen directly without requiring the dispatcher to manually open each task.

---

## ▶ Force Assign

Processes eligible **UNASSIGNABLE** normal carts.

The action only affects carts eligible for Force Assignment.

Problem Solve is not modified.

---

## ▶ Partially Batched

Handles eligible carts inside the **Partially Batched** section independently from normal Force Assign.

---

## ▶ Auto Complete

Attempts the site's normal **Complete Task** action on eligible tasks.

Auto Complete does not automatically Force Assign a task when completion is unavailable.

---

## ▲ Missing Package QR

Checks jobs for packages marked:

- **MISSING**
- **DAMAGED**

When found, the tool generates QR codes for:

1. The package's **Scannable ID**
2. The package's associated **CART_...** location when available

If multiple missing or damaged packages are found, the QR window supports moving between them.

This feature is read-only and does not modify the job.

---

# 🔎 Associate Search & Autocomplete

Provides associate username/name suggestions in supported assignment fields.

Autocomplete is limited to relevant associate assignment/search fields so normal search boxes are not affected.

---

# 📱 QR Code Tools

The script includes QR functionality for operational values.

Selected text can be displayed as a QR code for quick scanner use.

The QR stays open until dismissed instead of closing automatically after a timer.

---

# ⚡ Performance

The script is designed to minimize impact on the COMO dashboard.

Performance optimizations include:

- No continuous whole-page scanning
- Targeted DOM updates
- Coalesced UI rendering
- Guarded network requests
- Hidden-tab work reduction
- Dashboard-only stats requests
- Reusing already-fetched data when possible
- No unnecessary assignment polling
- No background automatic task assignment system

The goal is to add dispatcher tools without making the normal COMO website feel slow.

---

## Features At A Glance

| Feature | Description |
|---|---|
| Early task sorting | Earliest Batch Target gets priority |
| Same-time package priority | Most packages first when Batch Targets match |
| Time Left | Live deadline countdown |
| Live tab | Current batchers and elapsed time |
| Today tab | Daily associate performance |
| Weekly tab | 7-day associate performance |
| Fastest tab | Top qualifying batching performances |
| Names tab | Associate lookup |
| Batchers | Current active batcher count |
| Recommended | Deadline-based staffing recommendation |
| Remaining | Remaining package workload |
| Fast stats loading | Restores recent stats while fresh data loads |
| Assign Cart | Assign selected associates to prioritized tasks |
| Force Assign | Process eligible UNASSIGNABLE carts |
| Partially Batched | Separate handling for partially batched carts |
| Auto Complete | Complete eligible tasks |
| Missing/Damaged QR | QR codes for problem packages and cart locations |
| Associate autocomplete | Suggestions in supported associate fields |
| QR Generator | Create scanner-friendly QR codes |
| Click to copy | Click supported associate names to copy |
| Resizable panel | Resize the Batcher Timer panel |
| Theme support | Dashboard UI adapts with the script theme |

---

# How To Install

## Step 1 — Install Tampermonkey

If you don't already have Tampermonkey, install the browser extension:

- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

---

## Step 2 — Install the Script

Click the link below.

Tampermonkey should automatically open the userscript installation screen.

Click **Install**.

👉 **[Click here to install the script](https://github.com/IbrahimaSy11/-como-scripts/raw/refs/heads/main/como-early-task-in-order.user.js)**

---

## Step 3 — Open COMO

Open the Amazon Fresh COMO Operations Dashboard.

The script starts automatically.

---

# How To Use

## Task Sorting

No action is required.

Tasks are automatically kept in Batch Target order so earlier deadlines receive priority.

---

## Time Left

The Time Left column appears automatically beside Batch Target.

It updates continuously while you are viewing the dashboard.

---

## Batcher Timer Dashboard

The panel is located above the Utilization section.

You can:

- Switch between **Live, Today, Weekly, Fastest, and Names**
- Search for an associate
- View elapsed batching time
- View bags/min
- View Batchers, Recommended, and Remaining
- Click supported associate names to copy them
- Resize the dashboard panel
- Reset the panel size

---

## Assigning Carts

Press:

**▶ Run → ▶ Assign Cart**

Then:

1. Search for an associate
2. Select the associate
3. Add additional associates if needed
4. Verify their numbered order
5. Press **Assign**

The script handles task priority automatically.

---

# Compatible Pages

Primary COMO support:

- `https://como-operations-dashboard-iad.iad.proxy.amazon.com/*`

Some associate autocomplete functionality is also supported on relevant:

- `https://na.store-management.f3.amazon.dev/*`

Features activate only on the pages where they are relevant.

---

# Updates

When a new version is published, Tampermonkey can detect the updated userscript.

Use Tampermonkey's update feature to install the latest version.

---

# Author

Built by **Ibrahim** — Amazon Fresh Dispatcher, UNY2
