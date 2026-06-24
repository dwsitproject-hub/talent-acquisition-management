# Operations Documentation

Deployment-specific and sensitive operational docs must **not** be committed to this repository.

## Private runbook (local only)

Store server-specific runbooks in `private-runbook/` at the repository root. This folder is **gitignored** and will not be pushed to GitHub.

Examples of what belongs there:

- SSH key setup and troubleshooting for production servers
- Server IP addresses, ports, and access procedures
- Environment-specific deployment steps (e.g. `Update Deployment.md`)
- Production credentials and connection details

## In-repo documentation

Use placeholder values only in committed docs:

- `your_db_user`, `your_secure_db_password`, `your-db-host`
- `your-dockerhub-username`, `IMAGE_TAG=1.0.0`
- `admin.example.com`, `api.example.com`, `careers.example.com`

Real values belong in server-local `.env.production` or your organization's secret manager.

## Related guides (sanitized)

- `ENV_SETUP_INSTRUCTIONS.md` — environment variable setup
- `docker-compose.production.yml` — production compose (reads from `.env.production`)
- `DATABASE_URL_SETUP_GUIDE.md` — database connection format
- `AWS_DEPLOYMENT_GUIDE.md` / `ALICLOUD_DEPLOYMENT_GUIDE.md` — cloud deployment
