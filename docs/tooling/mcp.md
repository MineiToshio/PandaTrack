# MCP Servers

Model Context Protocol (MCP) servers extend AI agents with external tool capabilities. This project uses a mix of project-level and user-level MCP servers.

## Project-level servers

Configured via Claude Code's MCP config (`claude mcp add`, or a gitignored project-level `.mcp.json`). Codex reads its own MCP configuration.

| Server     | Transport | Endpoint                             | Purpose                                                                                          |
| ---------- | --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **github** | HTTP      | `https://api.githubcopilot.com/mcp/` | Read/write GitHub issues, PRs, branches, files, and releases via the GitHub Copilot MCP gateway. |

### Authentication

The GitHub server requires a Personal Access Token with `repo` and `project` scopes. The token is passed as an `Authorization: Bearer <token>` header. Store the token in an environment variable or secret manager — **never hardcode it in committed files**.

> **Security note:** never commit the token. A project-level `.mcp.json` is gitignored; if a token ever appears in a committed file (any config or `.claude/settings.local.json`), rotate it immediately.

### Available tools (github)

A non-exhaustive list of the tools exposed by this server:

- `issue_read` / `issue_write` — read and create/update issues
- `add_issue_comment` / `add_reply_to_pull_request_comment`
- `pull_request_read` / `pull_request_review_write`
- `create_branch`, `list_branches`, `list_commits`
- `get_file_contents`, `create_or_update_file`, `push_files`
- `search_code`, `search_issues`, `search_pull_requests`
- `create_pull_request`, `merge_pull_request`
- `list_releases`, `get_latest_release`

## User-level servers

Configured at the Claude Code user level (not committed to the repo). These are available in Claude Code sessions.

| Server               | Purpose                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **posthog**          | Query events, funnels, feature flags, experiments, cohorts, and dashboards directly from the PostHog API. |
| **Claude Preview**   | Interact with a live preview of the running app (screenshot, click, fill, inspect, network logs).         |
| **Claude in Chrome** | Browser automation: navigate, read pages, fill forms, execute JS, capture screenshots/GIFs.               |
| **Scheduled Tasks**  | Create and manage scheduled remote agent runs (cron-based triggers).                                      |
| **MCP Registry**     | Search and discover available MCP servers.                                                                |
| **CCD Session**      | Session management tools (chapters, memory, background tasks).                                            |
| **CCD Directory**    | Request project directory listings scoped to session context.                                             |

## Adding a new MCP server

1. For project-wide servers (all devs and AI agents need it): add via `claude mcp add` (or a gitignored project `.mcp.json`). Document it in this file.
2. For personal/user-level servers: configure via `claude mcp add` or your IDE's user settings. No commit needed.
3. Add tool permissions to `.claude/settings.local.json` as they are approved during use.
4. Update this file with the new server's name, transport, and available tools.

## References

- [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP specification](https://modelcontextprotocol.io)
