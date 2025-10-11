# Contributing to Gemini Proxy

First off, thank you for considering contributing to Gemini Proxy! It's people like you that make Gemini Proxy such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inspiring community for all.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to see if the problem has already been reported. When you are creating a bug report, please include as many details as possible using our bug report template.

### Suggesting Enhancements

If you have a suggestion for the project, we'd love to hear it! Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please use our feature request template and provide as much detail as possible.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code follows the existing code style.
6. Issue that pull request!

## Development Process

### Setting Up Your Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/tranphuc8a/gemini_proxy.git
   cd gemini_proxy
   ```

2. **Set up the backend**
   ```bash
   cd backend/gemini-proxy
   # Configure application.properties
   mvn clean install
   ```

3. **Set up the database**
   ```bash
   # Install MariaDB
   # Import database.sql
   ```

### Coding Standards

#### Java (Backend)
- Follow Java naming conventions
- Use Checkstyle for code style enforcement
- Write Javadoc comments for public APIs
- Keep methods focused and small
- Write unit tests for new functionality
- Aim for high code coverage with JaCoCo

#### General Guidelines
- Write clear, self-documenting code
- Add comments for complex logic
- Keep commits atomic and well-described
- Follow the conventional commits specification:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `style:` for formatting changes
  - `refactor:` for code refactoring
  - `test:` for adding tests
  - `chore:` for maintenance tasks

### Testing

- Run checkstyle: `mvn checkstyle:checkstyle@checkstyle-all`
- Run tests: `mvn clean test`
- Generate coverage report: `mvn jacoco:report`

### Git Workflow

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request against the `main` branch

### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update documentation for any new or changed functionality
3. The PR will be merged once you have the sign-off of at least one maintainer

## Project Structure

```
gemini-proxy/
├── backend/         # Spring Boot backend
│   └── gemini-proxy/
│       ├── src/
│       ├── pom.xml
│       └── .docker/
├── db/              # Database scripts
├── .github/         # GitHub configuration
│   ├── workflows/   # CI/CD workflows
│   └── ISSUE_TEMPLATE/  # Issue templates
└── README.md
```

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Recognition

Contributors will be recognized in our README.md file. Thank you for your contributions! 🎉
