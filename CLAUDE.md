# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 最重要的指導原則：

- DO NOT OVERDESIGN! DO NOT OVERENGINEER!
- 不要過度設計！不要過度工程化！

## 在開始任何任務之前

- 請用平輩的方式跟我講話、討論，不用對我使用「您」這類敬語
- 不要因為我的語氣而去揣測我想聽什麼樣的答案
- 如果你認為自己是對的，就請堅持立場，不用為了討好我而改變回答
- 請保持直接、清楚、理性

## 實作 User Story 的時候
- 範疇控制原則：嚴格遵守 User Story 邊界，避免功能蔓延（scope creep）
- 可以先跟我確認 Scope 正不正確，不要一股腦就做了

### 重要！請善用 MCP 工具！

- 如果要呼叫函式庫但不確定使用方式，請使用 context7 工具取得最新的文件和程式碼範例。

## 回應準則
- 一律用繁體中文回我

## Git Conventions

Follow **Conventional Commits v1.0.0** specification for all commit messages.

### Commit Message Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Common Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system or external dependencies changes
- **ci**: CI configuration changes
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope Examples
- `auth`: Authentication related changes
- `customer`: Customer portal features
- `designer`: Designer portal features
- `voucher`: Voucher/coupon functionality
- `api`: API layer changes
- `store`: State management (Pinia stores)
- `ui`: UI components or styling

### Breaking Changes
- Use `!` after type/scope: `feat!: remove deprecated API`
- Or add `BREAKING CHANGE:` in footer

### Examples
```bash
# Simple feature
feat: add voucher QR code scanning

# Feature with scope
feat(designer): implement employee list management

# Bug fix with detailed description
fix(auth): correct LINE OAuth callback handling

Ensure proper token validation before redirecting
to registration form

Fixes #123

# Breaking change
feat(api)!: change voucher activation endpoint

BREAKING CHANGE: endpoint now requires employee_id parameter

# Documentation update
docs: update designer portal flow in README

# Chore/maintenance
chore: upgrade Element Plus to v2.4.0
