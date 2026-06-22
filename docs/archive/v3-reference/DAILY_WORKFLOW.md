# PRIVACT Frontend — Daily Workflow

How to work each day after tonight's setup is done. Read this once before tomorrow's first session, then refer back to specific sections as needed.

## TL;DR — the daily ritual

```
Morning:
  1. Open Ubuntu (or VS Code Windows → Ctrl+`)
  2. cd ~/projects/risk-frontend
  3. git pull
  4. npm run dev               (in one terminal, leave running)
  5. claude                    (in another terminal, start Claude session)
  6. Tell Claude what we're building today

Evening:
  1. git status                (review changes)
  2. git add -A
  3. git commit -m "..."
  4. git push                  (triggers Vercel preview deploy)
  5. Verify Vercel preview URL works
  6. /exit Claude
  7. Close terminals
```

That's the whole loop. Below is the detail for each step.

---

## 1. Opening a work session

### Option A: From Windows Terminal / Ubuntu terminal

1. Open Ubuntu from Start menu (or Windows Terminal → dropdown → Ubuntu).
2. `cd ~/projects/risk-frontend`

### Option B: From VS Code (recommended — has the editor + terminal in one window)

1. Open VS Code on Windows.
2. `Ctrl+Shift+P` → "WSL: Open Folder in WSL..." → navigate to `~/projects/risk-frontend`.
3. Open a terminal panel (`Ctrl+` `) — automatically a WSL terminal in the project folder.

### Pull latest changes
```bash
git pull
```
Why: in case you pushed from another machine, or someone else pushed (shouldn't happen on solo project, but habit). If nothing to pull, you'll see "Already up to date."

---

## 2. Starting the dev server (always on while you work)

In a terminal:
```bash
npm run dev
```

Vite starts on `http://localhost:5173`. Open it in your Windows browser. Keep this tab open all day — Vite auto-reloads when you save files.

**Leave this terminal running.** Don't close it. Open another terminal for everything else.

If you ever need to install a new library mid-session, stop the dev server (Ctrl+C), `npm install <thing>`, then `npm run dev` again.

---

## 3. Starting a Claude Code session

In a **second** terminal in the same project folder:
```bash
claude
```

This starts a Claude session **inside your project directory**. Claude sees your files. Claude can edit your files. Claude can run commands (with your approval).

### What to say at the start of a new session

Claude doesn't remember previous sessions. Every time you start `claude`, you re-introduce the context.

**Day 1 (tomorrow morning) — Login screen:**
```
We're continuing the PRIVACT frontend project.

Please read docs/MASTER_PROMPT.md, docs/screens.md, docs/working-agreement.md, and docs/stack-decisions.md to understand the project.

Tonight we finished the scaffold: WSL + Node + Claude CLI + Vite + React + TS + Mantine + TanStack + MSW + Router + placeholder Login and Project List + GitHub + Vercel.

Today we're building Screen 1: the real Login screen, replacing the placeholder at src/pages/LoginPage.tsx.

Before we code anything, ask me the 5 pre-screen questions (see working-agreement.md).
```

**Any subsequent day — pick a screen:**
```
We're continuing the PRIVACT frontend project.

Please read docs/MASTER_PROMPT.md, docs/screens.md, and docs/working-agreement.md first.

Today we're building Screen N: <screen name>.

Look at the existing code in src/ to understand what's already built. Then ask me the 5 pre-screen questions before coding.
```

Claude reads the docs, looks at the codebase, then asks you the 5 questions.

---

## 4. The 5 pre-screen questions

Every screen starts with Claude asking these. Have your answers ready before starting a session:

1. **What does the user see when this screen loads?** Empty state? Loading state? Pre-filled with data from previous step?
2. **What can the user do here?** Every button, every interaction, even obvious ones.
3. **What data does the screen need from the backend?** Which endpoints from `docs/backend-endpoints.md`?
4. **What happens when the user does each action?** Where do they go? Does data save? Optimistic update or wait for server?
5. **What's out of scope for this version?** So Claude doesn't over-build.

If you don't know an answer, say "I'm not sure, what do you propose?" Claude suggests a default.

**This step is the most important one of the day.** Spend 5-10 minutes here. Don't rush. A clear spec means Claude writes the right code on the first try, not the third.

---

## 5. Building the screen

After the 5 questions, Claude proposes a plan:
- Which files to create or modify
- Which MSW handlers to add (the mock backend responses)
- Which TypeScript types to define
- The order of work

You say "go" or "wait, change X first." Then Claude writes the code.

### Mode 1: Claude makes the edits directly

Claude proposes a file change. You see a diff. You approve or reject.

```
Claude: I'll create src/pages/LoginPage.tsx with the following content:
        [shows full file content]
        
        Approve? (y/n)
You: y
```

### Mode 2: Claude tells you commands to run

```
Claude: Run: npm install <package>
You: <run it in another terminal, paste output back if relevant>
```

### Mode 3: Claude asks for help (you're its eyes)

```
Claude: I made the change. Can you check localhost:5173 and tell me what you see?
You: <look in browser, screenshot or describe the result>
```

### When something is wrong

- "I see this error: <paste exact error>"
- "It looks wrong — see screenshot" (attach the screenshot)
- "It works but X is misaligned / X color is off / X doesn't respond"

Claude iterates. Expect 2-3 iterations per non-trivial screen. That's normal — not a problem with you or Claude.

---

## 6. Checking your work

For each screen, before you call it done:

1. **Visual check.** Open `localhost:5173`, navigate to the screen, compare against the wireframe in `PRIVACT_UI_Screens.pptx`. Close enough? Better? Worse?
2. **Functional check.** Click every button. Try every input. Try invalid input. Does anything break?
3. **Empty / loading / error states.** What does the screen look like with no data? While loading? When the API fails? (MSW lets you simulate errors — ask Claude to add a 500-response mock for testing.)
4. **Responsive check.** Resize the browser to ~800px wide. Does the layout still work? Mantine handles most of this but check anyway.
5. **Console.** Open Chrome DevTools (F12) → Console tab. Any red errors? Yellow warnings? Tell Claude about them.
6. **TypeScript check.** Run `npm run build` once. If it compiles, your types are coherent. If not, paste the error to Claude.

---

## 7. Ending the day — commit and push

When you're at a stopping point (doesn't have to be "done"):

```bash
# Stop the dev server (Ctrl+C in that terminal) — optional but cleaner

git status                              # See what changed
git diff                                # Review the actual changes (optional)
git add -A                              # Stage all
git commit -m "Screen N: <what you did>"
git push                                # Push to GitHub
```

Commit messages: short, action-oriented. Examples:
- `"Screen 1: real Login with Keycloak stub button"`
- `"Screen 2: Project List table with mocked data"`
- `"Fix: Project List status badge colors"`
- `"WIP: Phase 1b asset table — drawer not yet wired"`

Push triggers Vercel to redeploy. Within ~1 minute, your preview URL has the latest changes. Share that URL with the consortium when you want feedback.

### Exit Claude
```
/exit
```
or just close the terminal. Session ends. Local files keep everything Claude did.

---

## 8. Suggested rhythm for the 11 screens

Each screen is roughly 1 session of 2-4 hours. Some are faster, some slower.

| Day | Screen | Notes |
|---|---|---|
| Day 1 | Screen 1 — Login (real) | Short. Mostly visual. Easy warm-up. |
| Day 2 | Screen 2 — Project List | Mantine Table + search + new-project modal. |
| Day 3 | Screen 3 — Project Overview / Hub | Vertical stepper. Mostly layout. |
| Day 4 | Screen 4 — Phase 1a Setup Form | Simple form with sliders. Quick. |
| Day 5-7 | Screen 5 — Phase 1b Asset Inventory (table) | **Hardest screen.** Table + drawer + 15-cell ROLFP grid + Links tab. Take it slow. |
| Day 8 | Screen 6 — Phase 2 Review | Two read-only filterable tables. |
| Day 9-10 | Screen 7 — Phase 3 Triplets | TanStack Table with 5k rows + server-side pagination. Real TS Table work. |
| Day 11-13 | Screen 8 — Phase 4a Mitigation Planner ★ | **Showcase feature.** Two-pane, live residual risk. Optimistic updates. |
| Day 14-15 | Screen 9 — Phase 4b Dashboard | Heatmap + bar chart + KPI cards. Visual but contained. |
| Day 16 | Screen 10 — Phase 4c Export | Mostly UI + download triggers. |
| Day 17+ | Screen 5 v2 — Topology Canvas (React Flow) | Polish layer for Phase 1b. Build only after everything else works. |
| Day 18+ | Screen 11 — Catalog Browser | Optional. Skip for v1 if time tight. |

**Plan 4-5 weeks for the 7 critical screens** (1-10 except canvas). Plus 2-3 weeks of polish, debugging, integration testing.

Don't measure by days. Measure by "is the screen good enough to demo?" If yes, move on. If no, another session.

---

## 9. When to start a new Claude session vs continue

**Start a new `claude` session when:**
- New day
- Switching to a different screen
- Current session getting confused / forgetful
- After a long break (>2 hours)
- You're about to do something risky (refactor, dependency update) — fresh session = clearer thinking

**Continue an existing session when:**
- Same screen, iterating
- You just stepped away for 15 minutes
- Claude has a lot of context loaded that would take time to rebuild

Claude Code keeps session history locally. You can also resume a previous session — check `claude --help` for the command (typically `claude --resume` or similar).

---

## 10. The five things Claude can do for you (and one it can't)

### Can do
1. **Read your files.** Just ask: "look at src/pages/ProjectListPage.tsx and tell me how it loads data."
2. **Edit your files.** "Refactor this component to use useQuery instead of useEffect."
3. **Run commands.** "Run npm install <x>" — it asks approval, runs it, shows output.
4. **Debug from errors you paste.** "Here's the console error: ... what's wrong?"
5. **Plan multi-step tasks.** "We need to add real Keycloak auth. What's the plan?"

### Can't do
- **See what's in your browser.** It can't open `localhost:5173`. You have to be the eyes. Take screenshots, describe what you see, paste console output.

---

## 11. Common commands cheatsheet

| Task | Command |
|---|---|
| Start dev server | `npm run dev` |
| Stop dev server | Ctrl+C in that terminal |
| Install a new library | `npm install <name>` |
| Install a dev-only library | `npm install -D <name>` |
| Type check + build | `npm run build` |
| Start Claude session | `claude` |
| Exit Claude | `/exit` or Ctrl+D |
| See what changed | `git status` |
| See exact changes | `git diff` |
| Stage and commit | `git add -A && git commit -m "msg"` |
| Push to GitHub | `git push` |
| Pull latest | `git pull` |
| See recent commits | `git log --oneline -10` |
| Discard uncommitted changes to a file | `git checkout -- <file>` |
| Undo last commit (keep changes) | `git reset HEAD~1` |
| List installed npm packages | `npm list --depth=0` |

---

## 12. When things go wrong

### Dev server won't start
- Port 5173 already in use? Kill it: `lsof -i:5173` (find PID), `kill <PID>`. Or change port in `vite.config.ts`.
- `node_modules` corrupt? `rm -rf node_modules package-lock.json && npm install`

### TypeScript errors after pulling
- `rm -rf node_modules && npm install` — sometimes dependencies drift.

### Mantine styles look broken
- Check `main.tsx` imports the Mantine CSS files (`@mantine/core/styles.css`).
- Hard refresh browser: Ctrl+Shift+R.

### MSW returns nothing / requests hit network
- Check the service worker file exists: `public/mockServiceWorker.js`.
- If missing: `npx msw init public/ --save`.
- Check `main.tsx` has the `enableMocking()` call.
- Check browser DevTools → Application → Service Workers. Should show MSW worker active.

### `git push` says "Authentication failed"
- Personal Access Token expired or wrong.
- Generate new token (github.com → Settings → Developer settings → PATs).
- Update credentials: `git credential reject https://github.com` (clears cache), then push again with new token.

### Claude session feels stuck or confused
- `/exit`, start fresh `claude` session.
- If a complex back-and-forth is going sideways, just restart and re-state the goal with fresh context.

### Vercel preview broken but local works
- Check Vercel build logs (vercel.com → project → latest deployment → build logs).
- Usually a missing env variable, wrong build command, or a TypeScript error that only shows on production build.
- Run `npm run build` locally to reproduce.

---

## 13. End-of-week habits

Every Friday (or whenever you end a week):

1. Commit and push everything (no WIP left local).
2. Review `docs/open-questions.md` — anything new to add? Anything resolved?
3. Update `docs/screens.md` if implementation diverged from spec (e.g. you decided to skip a button).
4. Look at the Vercel preview URL on a phone — does the responsive layout hold?
5. Take 10 min to play with the app as a fictional user — what's annoying? Note it for next week.

---

## 14. When to ask the new Claude to write a continuation prompt

If at any point you want to switch to a new Claude chat (incognito web for design discussion, fresh terminal session, etc.) and want it to have full context:

In your current `claude` session, say:
```
Write me a continuation prompt I can paste into a new Claude chat. Capture: project status, what's built, what's next, current decisions, open issues.
```

Claude generates a tailored prompt for your current state. Save it as `docs/continuation-YYYY-MM-DD.md` for your records, and paste it into the new chat.

---

## You're ready

That's the workflow. The setup we did tonight is the only complicated part. Daily work is `cd + npm run dev + claude + work + commit + push`. The CLI handles the rest.

Καλή τύχη.
