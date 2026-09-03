# GitHub Configuration

This directory contains all GitHub-specific configuration files for the Gemini Proxy project.

## Structure

```
.github/
├── CODEOWNERS                    # Define code owners for automatic review requests
├── CONTRIBUTING.md               # Contribution guidelines
├── FUNDING.yml                   # Sponsorship configuration
├── ISSUE_TEMPLATE/               # Issue templates
│   ├── bug_report.yml           # Bug report template
│   ├── config.yml               # Issue template configuration
│   ├── documentation.yml        # Documentation issue template
│   └── feature_request.yml      # Feature request template
├── PULL_REQUEST_TEMPLATE.md     # Pull request template
├── SECURITY.md                  # Security policy
├── dependabot.yml               # Dependabot configuration
├── labels.yml                   # Label definitions
└── workflows/                   # GitHub Actions workflows
    ├── build_and_push.be.yml   # Build and push backend Docker image
    ├── codeql.yml              # CodeQL security analysis
    └── test_on_pr.be.yml       # Test backend on pull requests
```

## Files Overview

### CODEOWNERS
Defines code owners for different parts of the repository. When a PR is created, the defined owners will automatically be requested for review.

### CONTRIBUTING.md
Provides guidelines for contributing to the project, including:
- Code of conduct
- How to report bugs
- How to suggest enhancements
- Pull request process
- Development environment setup
- Coding standards

### FUNDING.yml
Configuration for displaying sponsorship options on the repository. Update this file with your sponsorship links (GitHub Sponsors, Ko-fi, etc.).

### ISSUE_TEMPLATE/
Contains form-based issue templates:
- **bug_report.yml**: For reporting bugs with structured fields
- **feature_request.yml**: For suggesting new features
- **documentation.yml**: For documentation improvements
- **config.yml**: Configures contact links and enables blank issues

### PULL_REQUEST_TEMPLATE.md
Template that appears when creating a new pull request. Includes sections for:
- Description
- Type of change
- Related issues
- Changes made
- Testing checklist
- Additional context

### SECURITY.md
Security policy that explains:
- Supported versions
- How to report security vulnerabilities
- Disclosure policy

### dependabot.yml
Automated dependency updates configuration for:
- Maven (Java backend)
- GitHub Actions
- Docker
Updates are scheduled weekly/monthly with auto-labeling and grouping.

### labels.yml
Defines consistent labels for issues and pull requests across:
- Type (bug, enhancement, documentation, security)
- Status (triage, in progress, blocked, etc.)
- Component (backend, frontend, database, ci/cd)
- Priority (critical, high, medium, low)
- Dependencies (java, docker, github-actions)

### workflows/

#### build_and_push.be.yml
CI/CD workflow that:
- Runs on push to main/backend/cicd branches
- Executes checkstyle and tests
- Builds JAR file
- Creates Docker image
- Pushes image to DockerHub

#### codeql.yml
Security analysis workflow that:
- Runs on push/PR to main
- Scheduled weekly scans
- Analyzes Java code for security vulnerabilities
- Reports findings in Security tab

#### test_on_pr.be.yml
PR validation workflow that:
- Runs on PRs targeting main branch
- Executes checkstyle
- Runs tests with JaCoCo coverage
- Uploads coverage reports

## Usage

### For Contributors
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making contributions
2. Use issue templates when reporting bugs or suggesting features
3. Follow the PR template when submitting changes
4. Ensure all CI checks pass before requesting review

### For Maintainers
1. Review [CODEOWNERS](CODEOWNERS) to update code ownership
2. Update [SECURITY.md](SECURITY.md) with security contact info
3. Configure [FUNDING.yml](FUNDING.yml) with sponsorship links
4. Review and merge dependabot PRs regularly
5. Monitor CodeQL security alerts in the Security tab

## Best Practices

### Workflows
- All workflows use pinned action versions (e.g., `@v4`)
- Permissions are explicitly defined for security
- Caching is used to speed up builds
- Artifacts are properly versioned and uploaded

### Issue Management
- Use labels to categorize and prioritize issues
- Assign code owners for better accountability
- Use milestones for release planning
- Link issues to PRs using keywords (Fixes #123)

### Security
- Never commit secrets or credentials
- Review dependabot PRs for breaking changes
- Monitor CodeQL alerts regularly
- Follow responsible disclosure for security issues

## Maintenance

### Updating Action Versions
Dependabot will automatically create PRs to update GitHub Actions. Review and merge these regularly.

### Updating Templates
When updating templates, ensure they remain user-friendly and don't require excessive information.

### Workflow Optimization
Monitor workflow run times and optimize caching, dependencies, and job parallelization as needed.

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Issue Template Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
