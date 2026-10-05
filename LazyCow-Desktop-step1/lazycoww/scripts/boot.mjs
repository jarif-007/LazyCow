// @ts-check
/* eslint-env node */
// lazycoww/scripts/boot.mjs
// Assembles doc/SESSION_BOOT.md from onboarding + voice + decisions + context
// + missions + handoff + journal + git state. Copies the result to clipboard.

import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// doc/ lives two levels up: lazycoww/scripts/ → lazycoww/ → LazyCow-Desktop-step1/doc/
const step1Root = path.resolve(here, '..', '..')
const docDir = path.join(step1Root, 'doc')

/**
 * Read a doc file, returning a fallback if missing.
 * @param {string} f
 * @param {string} [fallback]
 */
const read = (f, fallback = `(missing: doc/${f})`) => {
    try { return fs.readFileSync(path.join(docDir, f), 'utf8') } catch { return fallback }
}

/**
 * Run a shell command, returning trimmed stdout or an error marker.
 * @param {string} cmd
 */
const run = (cmd) => {
    try { return execSync(cmd, { cwd: step1Root, encoding: 'utf8' }).trim() }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return `(failed: ${msg.split('\n')[0]})`
    }
}

// ── §0 Meta-prompt ─────────────────────────────────────────────────────
const META = `<!-- LazyCow SESSION_BOOT — paste this entire file into any new AI chat. -->

You are my LazyCow tutor and coding partner. Read this ENTIRE document before doing anything.

Your onboarding is described in §0 — follow it step by step.
§1–§6 give you everything else you need to know.

Then in order:
1. Follow §0 Onboarding — the exact steps for setting yourself up.
2. Follow §1 Voice & Rhythm — non-negotiable tone and workflow.
3. Read §2 Decisions — WHY the code looks like it does. Never suggest a reverted alternative.
4. Read §3 Context — stable architecture.
5. Read §4 Missions — active work queues.
6. Read §5 Handoff — exactly where the last session stopped.
7. Read §6 Journal — recent change history.
8. Read §7 Git state (auto-captured).

When I say "checkpoint" / "sync" / "commit":
- Update doc/handoff.md §1–§5.
- Fill in any pending journal.md stub.
- Tick/untick doc/missions.md.
- Clear §5-PENDING entries I've confirmed.

When you make a code change:
- First add a §5-PENDING line to doc/handoff.md.
- Then give the FIND/REPLACE.
- Clear it after I confirm.

When you make an architectural decision: append to doc/decisions.md.
When a fix fails: append "Tried: <approach> — <why>" to the bug's entry in §2, plus a "Next attempt:" line.
Never suggest an approach listed under "Tried:" in decisions.md or handoff.md.

---

`

const onboarding = `# §0 Onboarding — how to set yourself up\n\n${read('onboarding.md')}\n\n---\n\n`
const voice = `# §1 Voice & Rhythm\n\n${read('voice.md')}\n\n---\n\n`
const decisions = `# §2 Decisions (append-only — do not suggest reverted alternatives)\n\n${read('decisions.md')}\n\n---\n\n`
const context = `# §3 Context — stable architecture\n\n${read('context.md')}\n\n---\n\n`
const missions = `# §4 Missions — active work queues\n\n${read('missions.md')}\n\n---\n\n`
const handoff = `# §5 Handoff — where the last session stopped\n\n${read('handoff.md')}\n\n---\n\n`
const journal = `# §6 Journal — recent changes\n\n${read('journal.md')}\n\n---\n\n`

// ── §7 Git state ───────────────────────────────────────────────────────
const now = new Date().toISOString()
const branch = run('git rev-parse --abbrev-ref HEAD')
const head7 = run('git rev-parse --short HEAD')
const status = run('git status --short') || '(clean)'
const log = run('git log --oneline -15')

// Stale detection: compare handoff's "Last commit:" line against actual HEAD.
let staleness = ''
try {
    const handoffRaw = read('handoff.md', '')
    const m = handoffRaw.match(/Last commit:\s*([0-9a-f]{7,40})/i)
    if (m && !m[1].startsWith(head7)) {
        staleness = `\n⚠️ STALE HANDOFF: handoff.md says last commit is ${m[1]}, but actual HEAD is ${head7}.\nAsk the developer to reconcile before proceeding.\n`
    }
} catch { /* ignore */ }

const gitSection = `# §7 Git state (captured ${now})${staleness}

Branch: \`${branch}\`  HEAD: \`${head7}\`

Working tree:
\`\`\`
${status}
\`\`\`

Recent commits:
\`\`\`
${log}
\`\`\`

# §8 End of boot — waiting for your first instruction
`

// ── Write + copy ───────────────────────────────────────────────────────
const out = META + onboarding + voice + decisions + context + missions + handoff + journal + gitSection
const outPath = path.join(docDir, 'SESSION_BOOT.md')

try {
    fs.writeFileSync(outPath, out, 'utf8')
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`✗ Could not write ${outPath}: ${msg}`)
    process.exit(1)
}

const approxTokens = Math.round(out.length / 4)
console.log(`✓ Wrote ${outPath}`)
console.log(`  ~${approxTokens} tokens (${out.length} bytes)`)

try {
    const result = spawnSync('clip', [], { input: out, encoding: 'utf8' })
    if (result.error) throw result.error
    console.log('✓ Copied to clipboard. Paste into any new AI chat.')
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`✗ Clipboard copy failed: ${msg}`)
    console.log(`  Open the file and copy manually: ${outPath}`)
}