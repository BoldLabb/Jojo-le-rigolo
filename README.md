# Claude Code Statusline

Barre de statut riche pour Claude Code. Affiche en temps reel les informations de session, git, contexte, et limites d'utilisation Anthropic.

```
main* ↑3 ↓2 ~3 • …\mon-projet • Opus 4.6
S: $1.3 150k/1m ⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀ 15% →5k out $6.5/h (12m) • L: ⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀ 30% (+5.2%) (2h15m)
```

## Ce qui est affiche

**Ligne 1 — Contexte**
| Element | Description |
|---------|-------------|
| `main*` | Branche git (`*` = modifications non committees) |
| `↑3 ↓2` | Commits en avance/retard sur le remote |
| `~3 ~1` | Fichiers staged (gris) / unstaged (jaune) |
| `…\mon-projet` | Dossier de travail |
| `Opus 4.6` | Modele Claude utilise |

**Ligne 2 — Metriques**
| Element | Description |
|---------|-------------|
| `$1.3` | Cout de la session |
| `150k/1m` | Tokens utilises / taille max du contexte |
| `⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀ 15%` | Barre + % du contexte rempli |
| `⚠>200k` | Alerte quand le contexte depasse 200k tokens |
| `→5k out` | Tokens generes par Claude |
| `$6.5/h` | Vitesse de depense |
| `(12m)` | Duree de la session |
| `L: ⣿⣿⣿⣀⣀⣀ 30%` | % du quota 5h utilise (donnees reelles Anthropic) |
| `(+5.2%)` | Pacing — en avance (vert) ou en retard (rouge) |
| `(2h15m)` | Temps avant reset du quota 5h |
| `W: ...` | Usage hebdo — apparait auto quand le quota 5h depasse 90% |

## Installation

### Prerequis

- [Bun](https://bun.sh) installe sur votre machine
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installe

### Etapes

1. **Cloner le repo** dans le dossier scripts de Claude Code :

```bash
git clone <url-du-repo> ~/.claude/scripts/statusline
```

2. **Installer les dependances** :

```bash
cd ~/.claude/scripts/statusline
bun install
```

3. **Configurer Claude Code** — ajouter dans `~/.claude/settings.json` :

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun ~/.claude/scripts/statusline/src/index.ts",
    "padding": 0
  }
}
```

> **Windows** : remplacer `bun` par le chemin complet si bun n'est pas dans le PATH :
> ```json
> "command": "C:/Users/<user>/.bun/bin/bun.exe C:/Users/<user>/.claude/scripts/statusline/src/index.ts"
> ```

4. **Relancer Claude Code** — la barre apparait au prochain message.

### Tester l'installation

```bash
echo '{
  "session_id": "test",
  "transcript_path": "/tmp/test",
  "cwd": "/tmp",
  "model": { "id": "claude-opus-4-6", "display_name": "Opus 4.6" },
  "workspace": { "current_dir": "/tmp", "project_dir": "/tmp" },
  "version": "2.1.0",
  "output_style": { "name": "default" },
  "cost": { "total_cost_usd": 1.25, "total_duration_ms": 720000, "total_api_duration_ms": 468000, "total_lines_added": 50, "total_lines_removed": 10 },
  "context_window": { "total_input_tokens": 150000, "total_output_tokens": 5000, "context_window_size": 1000000, "used_percentage": 15, "remaining_percentage": 85, "current_usage": { "input_tokens": 120000, "output_tokens": 5000, "cache_creation_input_tokens": 20000, "cache_read_input_tokens": 10000 }},
  "exceeds_200k_tokens": false,
  "rate_limits": { "five_hour": { "used_percentage": 37, "resets_at": 1774033200 }, "seven_day": { "used_percentage": 24, "resets_at": 1774173600 }}
}' | bun run ~/.claude/scripts/statusline/src/index.ts
```

## Configuration

Tout se configure dans `statusline.config.json`. Chaque element est un toggle `true`/`false`.

### Options principales

```jsonc
{
  "oneLine": false,              // true = tout sur 1 ligne, false = 2 lignes
  "separator": "•",              // Separateur entre sections (•, |, ·, →, etc.)

  "git": {
    "showBranch": true,          // Nom de la branche
    "showDirtyIndicator": true,  // * quand il y a des modifications
    "showAheadBehind": true,     // ↑3 ↓2 commits ahead/behind
    "showChanges": false,        // +156 -23 lignes dans le diff
    "showStaged": true,          // ~3 fichiers staged
    "showUnstaged": true         // ~1 fichiers unstaged
  },

  "session": {
    "cost": { "enabled": true },      // $1.3
    "tokens": {
      "enabled": true,
      "showMax": true                  // 150k/1m au lieu de 150k
    },
    "percentage": {
      "enabled": true,
      "showValue": true,               // 15%
      "progressBar": {
        "enabled": true,
        "length": 10,                  // 5, 10 ou 15 caracteres
        "style": "braille",            // braille, filled, rectangle
        "color": "progressive"         // change de couleur selon le %
      }
    },
    "outputTokens": { "enabled": true },    // →5k out
    "alert200k": { "enabled": true },       // ⚠>200k
    "costPerHour": { "enabled": true },     // $6.5/h
    "apiRatio": { "enabled": false },       // API:65% (ratio temps API)
    "duration": { "enabled": true }         // (12m)
  },

  "limits": {
    "enabled": true,              // Section L:
    "showTimeLeft": true,         // (2h15m)
    "showPacingDelta": true       // (+5.2%)
  },

  "weeklyUsage": {
    "enabled": "90%"              // true, false, ou "90%" (auto quand L: > 90%)
  }
}
```

### Styles de barre de progression

| Style | Rendu |
|-------|-------|
| `braille` | `⣿⣿⣿⣦⣀⣀⣀⣀⣀⣀` |
| `filled` | `███░░░░░░░` |
| `rectangle` | `▰▰▰▱▱▱▱▱▱▱` |

### Couleurs de barre

| Mode | Comportement |
|------|-------------|
| `progressive` | Gris < 50%, jaune < 70%, orange < 90%, rouge >= 90% |
| `green` / `yellow` / `red` / `peach` | Couleur fixe |

## Structure du projet

```
src/
├── index.ts                 # Point d'entree
└── lib/
    ├── types.ts             # Types TypeScript (HookInput)
    ├── config.ts            # Chargement de la config
    ├── config-types.ts      # Types de configuration
    ├── git.ts               # Statut git (branche, changes, ahead/behind)
    ├── context.ts           # Calcul du contexte depuis le transcript
    ├── render-pure.ts       # Rendu pur (data in, string out)
    ├── formatters.ts        # Couleurs, barres, formatage
    ├── utils.ts             # Utilitaires
    └── features/
        └── limits.ts        # Fallback local pour les limites (si rate_limits absent du payload)
```

## Source des donnees

Toutes les donnees affichees sont reelles :

| Donnee | Source |
|--------|--------|
| Git | Commandes git locales |
| Cout, duree, tokens | Payload Claude Code |
| % contexte | `context_window.used_percentage` (officiel Claude Code) |
| % quota 5h/7j | `rate_limits.*.used_percentage` (officiel Anthropic) |
| Temps reset | `rate_limits.*.resets_at` (officiel Anthropic) |
| Cout/heure, pacing | Derives de donnees officielles |

## Licence

MIT
