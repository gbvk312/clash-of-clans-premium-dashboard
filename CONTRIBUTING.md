# Contributing to Clash of Clans Premium Dashboard

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Submit a Pull Request](#how-to-submit-a-pull-request)
- [Code Style Guidelines](#code-style-guidelines)
- [Reporting Issues](#reporting-issues)

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Installation

```bash
# Clone your fork
git clone https://github.com/<your-username>/clash-of-clans-premium-dashboard.git
cd clash-of-clans-premium-dashboard

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Running Tests

```bash
npm test
```

## How to Submit a Pull Request

1. **Create a branch**: Create a new branch from `master` for your changes.
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes**: Implement your feature or bug fix.
3. **Commit your changes**: Write clear, concise commit messages.
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request**: Go to the original repository and open a PR from your branch.
   - Provide a clear title and description of your changes
   - Reference any related issues (e.g., `Closes #123`)
   - Ensure all checks pass before requesting a review

## Code Style Guidelines

- **JavaScript**: Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) conventions
- **Formatting**: Use consistent indentation (2 spaces)
- **Naming**: Use camelCase for variables and functions, PascalCase for classes and components
- **Comments**: Write meaningful comments for complex logic; avoid obvious comments
- **Files**: Use kebab-case for file names
- **ES6+**: Prefer modern JavaScript syntax (arrow functions, destructuring, template literals, etc.)
- **No unused code**: Remove dead code, unused imports, and commented-out blocks before submitting

## Reporting Issues

When reporting issues, please include:

1. **Description**: A clear and concise description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the behavior
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Screenshots**: If applicable, add screenshots to help explain the issue
6. **Environment**:
   - OS and version
   - Node.js version
   - Browser and version (if applicable)

### Issue Labels

- `bug` – Something isn't working
- `enhancement` – New feature or improvement request
- `documentation` – Improvements to documentation
- `good first issue` – Good for newcomers

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
