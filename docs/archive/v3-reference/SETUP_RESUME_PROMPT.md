# PRIVACT Frontend — Setup In Progress (Resume Here)

## ⚠️ Read this first

This is a **resumption** of a previous Claude session lost to an incognito reboot. Read this whole prompt and the attached docs before responding. Pick up exactly where the previous Claude left off — don't restart from scratch.

## The bigger context

The user (solo frontend dev, on Windows, GitHub username `ialiprantis-prv`) is starting work on the PRIVACT Risk Assessment Platform — the frontend of an EU-funded AENAON cybersecurity project.

**For full project context, read the attached `PRIVACT_docs.zip`:**
- `MASTER_PROMPT.md` — project background, stack, working agreement
- `backend-endpoints.md` — ~25 REST endpoints
- `risk-engine-logic.md` — how the 4-phase risk engine works
- `screens.md` — the 11 screens we designed
- `working-agreement.md` — two-mode workflow
- `stack-decisions.md` — React+TS+Vite+Mantine+TanStack+MSW
- `open-questions.md` — TBDs
- `DAILY_WORKFLOW.md` — the workflow for each subsequent day

Plus (if attached):
- `PRIVACT_UI_Screens.pptx` — the 11 wireframes (design source of truth)
- 3 source files (xlsx, presentation pdf, grant agreement pdf)

## Where we are RIGHT NOW

Decisions locked in:
- **Run environment:** WSL2 + Ubuntu (NOT native Windows)
- **Project folder name:** `risk-frontend` at `~/projects/risk-frontend/` inside WSL
- **Tooling:** Claude Code CLI (standalone `claude` terminal tool), NOT desktop app. Reason: privacy on a shared Claude account.
- **Editor:** VS Code on Windows with WSL extension
- **Deployment:** GitHub (private repo) → Vercel preview URLs → custom domain later
- **First real screen tomorrow:** the Login screen (Screen 1). Tonight we create a placeholder; tomorrow it gets replaced with the real Login that follows the wireframe.

What's installed before this resume:
- Git: yes (already on Windows)
- Everything else: NO — to be installed inside WSL tonight

The user has NOT YET RUN any commands. They are at the very start.

## TONIGHT'S GOAL — fully scaffolded, deployable project ready for screen development tomorrow

By end of tonight, the user must have:
1. WSL2 + Ubuntu installed and working
2. Node.js + Git configured inside WSL
3. Claude Code CLI installed and authenticated
4. **Privacy verified** (CLI sessions invisible to other shared-account users) — non-negotiable
5. Project folder at `~/projects/risk-frontend/` with `docs/` subfolder populated from the zip
6. React + TypeScript + Vite scaffolded
7. All libraries installed (Mantine + ecosystem, TanStack Query, TanStack Table, MSW, React Router, React Hook Form, Zod, dayjs, tabler icons)
8. Mantine theme configured with PRIVACT colors (navy `#1E2A4A`, navy-dark `#0F1B36`, teal `#2DD4BF`, red `#EF4444`, amber `#F59E0B`, green `#10B981`)
9. Routing skeleton with all 11 screen routes
10. MSW set up with a stub `GET /me` endpoint
11. **Placeholder Login screen and placeholder Project List screen** (just enough to verify routing — Login button navigates to Project List)
12. Initial commit pushed to a new private GitHub repo (`risk-frontend`)
13. Vercel connected, first preview URL working

**Tomorrow opens with:** the user runs `claude` inside the project folder, you ask the 5 pre-screen questions for the real Login screen, and we build it on top of the existing scaffold. See `DAILY_WORKFLOW.md` for the exact day-by-day procedure.

## Pre-flight info already collected

- OS: Windows
- Node.js: not installed (will install inside WSL via nvm)
- Git: installed on Windows; we install fresh inside WSL too
- GitHub username: `ialiprantis-prv`
- GitHub email: ASK user before configuring git inside WSL
- WSL username: not yet picked — user will choose during install
- Working directory inside WSL: `~/projects/risk-frontend/`
- Time budget tonight: ~2.5 hours

## The 7 phases for tonight

### Phase 1 — Install WSL2 and Ubuntu (~15 min, includes reboot)

1. Open PowerShell **as Administrator**.
2. Run: `wsl --install -d Ubuntu`
3. Reboot when prompted.
4. After reboot, Ubuntu auto-launches (or open "Ubuntu" from Start menu).
5. Create Linux username (lowercase, no spaces) + password. **Password input is invisible — that's normal.**
6. Once at the Ubuntu prompt (`username@LAB-06:~$`), run:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

**Verification:** prompt returns clean after upgrade.

### Phase 2 — Node, Git, build essentials (~10 min)

Inside WSL Ubuntu terminal:

1. Build essentials + curl:
   ```bash
   sudo apt install -y build-essential curl
   ```

2. Install nvm (Node Version Manager):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
   Then close and reopen the terminal (or `source ~/.bashrc`).

3. Verify nvm: `nvm --version`

4. Install Node LTS:
   ```bash
   nvm install --lts
   nvm use --lts
   node --version
   npm --version
   ```

5. **ASK user for their GitHub email**, then configure git inside WSL:
   ```bash
   git config --global user.name "ialiprantis-prv"
   git config --global user.email "<email>"
   git config --global init.defaultBranch main
   ```

**Verification:** `node --version` shows v20+ or v22+.

### Phase 3 — Install Claude Code CLI (~5 min)

1. Install (verify the current official method at https://docs.claude.com/en/docs/claude-code if unsure):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Verify: `claude --version`

3. Run `claude` from anywhere to authenticate. It opens a browser for OAuth login. User logs in with their shared Claude account, exits with `/exit`.

### Phase 4 — Verify privacy (CRITICAL, ~5 min)

This is non-negotiable. Don't skip it.

1. Create throwaway folder:
   ```bash
   mkdir -p ~/privacy-test && cd ~/privacy-test
   ```

2. Run `claude`, have a tiny session with a unique recognizable string:
   ```
   > Please remember this exact phrase: "ZULU-9923-PRIVACY-TEST"
   ```
   Exit with `/exit`.

3. **User checks:** open Claude desktop app on Windows. Look in Code tab Recents AND chat history. Does "ZULU-9923-PRIVACY-TEST" appear?

4. **User checks:** open claude.ai in browser. Same search.

5. **Outcomes:**
   - ❌ Appears anywhere → CLI does NOT give privacy on this shared account. STOP. User needs own account before continuing.
   - ✅ Invisible everywhere → CLI is private. Proceed.

6. Clean up:
   ```bash
   cd ~ && rm -rf ~/privacy-test
   ```

### Phase 5 — Project folder + docs (~10 min)

1. Create structure:
   ```bash
   mkdir -p ~/projects/risk-frontend && cd ~/projects/risk-frontend
   ```

2. Copy the zip from Windows Downloads to WSL. **ASK user where they saved the zip** (default: `C:\Users\lab-06\Downloads\`). Then:
   ```bash
   cp /mnt/c/Users/lab-06/Downloads/PRIVACT_docs.zip ./
   sudo apt install -y unzip   # if unzip is not installed
   unzip PRIVACT_docs.zip
   mv privact-docs docs
   rm PRIVACT_docs.zip
   ls docs/
   ```

3. Copy source reference files. ASK user which files are in Downloads:
   ```bash
   mkdir -p docs/source
   cp /mnt/c/Users/lab-06/Downloads/*.xlsx docs/source/ 2>/dev/null || true
   cp /mnt/c/Users/lab-06/Downloads/*.pdf docs/source/ 2>/dev/null || true
   cp /mnt/c/Users/lab-06/Downloads/*.pptx docs/source/ 2>/dev/null || true
   ls docs/source/
   ```

4. Git init + gitignore + initial commit:
   ```bash
   git init
   cat > .gitignore <<'EOF'
   node_modules
   dist
   .env
   .env.local
   .DS_Store
   *.log
   .vite
   coverage
   docs/source
   EOF
   git add docs .gitignore
   git commit -m "Initial commit: project docs"
   ```
   (Note: `docs/source` is gitignored because it contains the original consortium files we don't want to publish.)

### Phase 6 — Scaffold Vite + React + TS + libraries (~20 min)

Inside `~/projects/risk-frontend/`:

1. Scaffold (note the dot):
   ```bash
   npm create vite@latest . -- --template react-ts
   ```
   When prompted "Current directory is not empty, proceed?" → choose "Ignore files and continue".

2. Install base deps: `npm install`

3. Install project libraries:
   ```bash
   npm install @mantine/core @mantine/hooks @mantine/notifications @mantine/dates @mantine/form @mantine/modals @tabler/icons-react
   npm install @tanstack/react-query @tanstack/react-table
   npm install react-router-dom
   npm install react-hook-form zod @hookform/resolvers
   npm install dayjs
   ```

4. Dev/mock deps:
   ```bash
   npm install -D msw @types/node
   ```

5. Test the scaffold loads:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in Windows browser. Should show default Vite + React page. Ctrl+C to stop.

### Phase 7 — Configure scaffold + GitHub + Vercel (~45 min)

Write code files for the user. They paste them into the file paths you specify.

**a) `src/theme.ts`** — Mantine theme with PRIVACT colors:
```ts
import { createTheme, MantineColorsTuple } from '@mantine/core';

const navy: MantineColorsTuple = [
  '#eef2ff', '#dde3f4', '#b6c1e3', '#8d9ed3', '#6b81c5',
  '#5571bc', '#4a68b9', '#3a58a3', '#324f93', '#1E2A4A'
];

const teal: MantineColorsTuple = [
  '#e5fdf7', '#d3f5ec', '#a8e8db', '#7adac7', '#54cdb6',
  '#3dc6ac', '#2DD4BF', '#26b59f', '#1ba086', '#018b6f'
];

export const privactTheme = createTheme({
  primaryColor: 'navy',
  colors: { navy, teal },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'md',
});
```

**b) `src/main.tsx`** — replace default with full provider stack + MSW:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { privactTheme } from './theme';
import App from './App';

const queryClient = new QueryClient();

async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    return worker.start({ onUnhandledRequest: 'bypass' });
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MantineProvider theme={privactTheme}>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </MantineProvider>
    </React.StrictMode>
  );
});
```

**c) `src/mocks/handlers.ts`**:
```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/me', () => {
    return HttpResponse.json({
      id: 'user-stub',
      name: 'Dev User',
      email: 'dev@privact.local',
    });
  }),
];
```

**d) `src/mocks/browser.ts`**:
```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

**e) MSW service worker file**:
```bash
npx msw init public/ --save
```

**f) `src/App.tsx`** — all routes:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProjectListPage from './pages/ProjectListPage';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/:id" element={<Placeholder name="Project Overview" />} />
      <Route path="/projects/:id/setup" element={<Placeholder name="Phase 1a — Setup" />} />
      <Route path="/projects/:id/assets" element={<Placeholder name="Phase 1b — Assets" />} />
      <Route path="/projects/:id/review" element={<Placeholder name="Phase 2 — Review" />} />
      <Route path="/projects/:id/triplets" element={<Placeholder name="Phase 3 — Triplets" />} />
      <Route path="/projects/:id/mitigations" element={<Placeholder name="Phase 4a — Mitigations" />} />
      <Route path="/projects/:id/dashboard" element={<Placeholder name="Phase 4b — Dashboard" />} />
      <Route path="/projects/:id/export" element={<Placeholder name="Phase 4c — Export" />} />
      <Route path="/catalog" element={<Placeholder name="Catalog Browser" />} />
    </Routes>
  );
}
```

**g) `src/pages/LoginPage.tsx`** — stub (tomorrow this becomes the real Login):
```tsx
import { Button, Center, Stack, Title, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const nav = useNavigate();
  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Title order={1}>PRIVACT</Title>
        <Text c="dimmed">Risk Assessment Platform</Text>
        <Text size="sm" c="orange">⚠️ Placeholder. Real Login built tomorrow.</Text>
        <Button size="lg" onClick={() => nav('/projects')}>Sign in (stub)</Button>
      </Stack>
    </Center>
  );
}
```

**h) `src/pages/ProjectListPage.tsx`** — stub:
```tsx
import { Container, Title, Text, Button, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function ProjectListPage() {
  const nav = useNavigate();
  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>My Projects</Title>
        <Button onClick={() => nav('/projects/demo-1')}>Open demo project</Button>
      </Group>
      <Text c="dimmed">Placeholder. Real Project List built later.</Text>
    </Container>
  );
}
```

**i) `src/pages/Placeholder.tsx`**:
```tsx
import { Container, Title, Text } from '@mantine/core';

export default function Placeholder({ name }: { name: string }) {
  return (
    <Container size="xl" py="xl">
      <Title order={2}>{name}</Title>
      <Text c="dimmed" mt="md">This screen is not built yet.</Text>
    </Container>
  );
}
```

**j) Test the whole thing:**
```bash
npm run dev
```
Open `http://localhost:5173`. Should land on login → click "Sign in (stub)" → `/projects` opens. Routing works. Stop with Ctrl+C.

**k) Commit:**
```bash
git add -A
git commit -m "Scaffold: Vite+React+TS, Mantine theme, TanStack, MSW, Router, placeholder pages"
```

**l) GitHub:**
1. User: go to https://github.com/new in browser.
2. Create **private** repo `risk-frontend`. NO README, NO gitignore (we have ours).
3. Back in WSL:
   ```bash
   git remote add origin https://github.com/ialiprantis-prv/risk-frontend.git
   git branch -M main
   git push -u origin main
   ```
4. Authentication: GitHub prompts for credentials. **Use a Personal Access Token, NOT password.** If user doesn't have a PAT:
   - github.com → Settings (top right) → Developer settings (bottom left) → Personal access tokens → Tokens (classic) → Generate new token (classic)
   - Note: "PRIVACT dev — WSL machine"
   - Expiration: 90 days (or longer)
   - Scopes: tick **`repo`** (full control of private repos)
   - Generate, copy the token immediately (won't be shown again)
   - Use as password when WSL prompts. Username = `ialiprantis-prv`.
   - Optionally cache for future pushes: `git config --global credential.helper store` (insecure but simple), or set up GitHub CLI for proper auth.

**m) Vercel:**
1. User: https://vercel.com → Sign Up → Continue with GitHub → authorise.
2. Dashboard → Add New → Project → Import `risk-frontend`.
3. Framework: Vite (auto-detected). Leave other settings default.
4. Click Deploy. Wait ~1 minute.
5. Get a `risk-frontend-xxx.vercel.app` URL. Open it. Should see placeholder Login.

**Done.** Tonight's complete. Tell user to follow `DAILY_WORKFLOW.md` for tomorrow.

## Working agreement (read carefully)

Two modes:
- **Mode 1 — "Tell me what to do":** You give exact commands/files. User runs/creates them.
- **Mode 2 — "Give me the code":** For full components, you write the whole thing.

Every instruction includes: (1) exact path/command, (2) what to run after, (3) what success looks like, (4) what to check if it breaks.

One question at a time when possible. No emojis. Code in code blocks. Greek OK for high-level discussion, English for code/technical.

User is solo and learning the stack. Explain rationale when it matters.

## Your first response

1. Confirm you've read this prompt AND the attached docs (especially `screens.md`, `working-agreement.md`, `stack-decisions.md`).
2. Briefly summarise back: project, stack, 11 screens, tonight's 7 phases, the working agreement.
3. Ask the user one question: are they ready to start Phase 1, and is ~2.5 hours OK?
4. Once they confirm, start Phase 1 (the `wsl --install` command). Walk through one phase at a time with clear verification checkpoints.

Now read the docs, summarise back, ask the readiness question, and let's resume.
