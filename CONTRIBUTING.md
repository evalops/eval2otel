# Contributing to Eval2Otel

Thank you for your interest in contributing to Eval2Otel! We welcome contributions from the community.

## Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/eval2otel.git
   cd eval2otel
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run the build** to ensure everything works:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Run tests and linting**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## Coding Standards

- **TypeScript**: All code must be written in TypeScript with proper types
- **ESLint**: Code must pass all ESLint checks (including security rules)
- **Tests**: New features must include comprehensive test coverage
- **Documentation**: Update README.md and code comments as needed

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `style:` - Code formatting changes
- `chore:` - Maintenance tasks

## Testing

- Write unit tests for all new functionality
- Ensure all existing tests continue to pass
- Aim for high test coverage
- Test with different OpenTelemetry backends when possible

## Pull Request Guidelines

- **Title**: Use descriptive titles following conventional commit format
- **Description**: Clearly describe what your PR does and why
- **Tests**: Include tests for new functionality
- **Documentation**: Update documentation if needed
- **Breaking Changes**: Clearly mark any breaking changes

## Code Review Process

1. All PRs require at least one maintainer review
2. All CI checks must pass
3. Address any feedback from reviewers
4. Maintainer will merge once approved

## OpenTelemetry Compliance

When adding new features, ensure they follow:

- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [OpenTelemetry API Standards](https://opentelemetry.io/docs/specs/otel/)
- Security best practices for handling sensitive data

## Questions or Need Help?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

## License

By contributing to Eval2Otel, you agree that your contributions will be licensed under the MIT License.
