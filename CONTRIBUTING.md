# 🤝 Contributing to Wallet Provider

Thank you for your interest in contributing to the Wallet Provider project! We appreciate your help in building a modular, extensible wallet provider abstraction for the Algorand ecosystem.

## 📋 Table of Contents

- [💻 Development Environment](#development-environment)
- [🔄 Workflow](#workflow)
- [📏 Coding Standards](#coding-standards)
- [🧪 Testing](#testing)
- [📝 Commit Messages](#commit-messages)
- [🚀 Pull Request Process](#pull-request-process)

## 💻 Development Environment

This project uses `pnpm` as its package manager. We recommend using [Corepack](https://nodejs.org/api/corepack.html) to manage the `pnpm` version.

1. Enable Corepack:
   ```bash
   corepack enable
   ```
2. Fork and clone the repository.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build the project:
   ```bash
   pnpm build
   ```

## 🔄 Workflow

1. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix-name
   ```
2. Make your changes and ensure the project builds.
3. Verify your changes with tests and linting (see below).

## 📏 Coding Standards

We use `oxlint` for linting and `oxfmt` for formatting.

- To check for linting issues:
  ```bash
  pnpm lint
  ```
- To automatically fix linting issues:
  ```bash
  pnpm lint:fix
  ```
- To check formatting:
  ```bash
  pnpm fmt:check
  ```
- To automatically format code:
  ```bash
  pnpm fmt
  ```

## 🧪 Testing

We use `vitest` for testing.

- To run tests:
  ```bash
  pnpm test
  ```
- To run tests with coverage:
  ```bash
  pnpm test:cov
  ```
- To run benchmarks:
  ```bash
  pnpm bench
  ```

## 📝 Commit Messages

This project uses `semantic-release`, which requires [Conventional Commits](https://www.conventionalcommits.org/).

Please format your commit messages as follows:

- `feat: ...` for new features.
- `fix: ...` for bug fixes.
- `docs: ...` for documentation changes.
- `chore: ...` for maintenance tasks.
- `test: ...` for adding or fixing tests.
- `refactor: ...` for code refactoring without behavior changes.

Example:

```text
feat(provider): add support for custom extensions
```

## 🚀 Pull Request Process

1. Ensure your code follows the coding standards and passes all tests.
2. Update the documentation if you've added or changed any functionality.
3. Submit a Pull Request to the `main` branch.
4. Provide a clear description of your changes and why they are necessary.
5. Once submitted, your PR will be reviewed by the maintainers.

---

By contributing, you agree that your contributions will be licensed under the project's [Apache-2.0 License](./LICENSE).
