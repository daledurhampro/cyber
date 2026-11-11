# Cybersecurity Analyzer

An AI agent that reviews source code for security vulnerabilities. It combines **Semgrep** static analysis (called through an **MCP server**) with an **OpenAI** model's own review, and returns a structured report with CVSS scores and suggested fixes.

You can run it locally, as a single Docker container, on **Azure Container Apps**, or on **Google Cloud Run**.

In production a single container serves both parts on port **8000**: FastAPI handles `/api/*` and `/health`, and serves the Next.js static export for every other path. You get one image, one port, no CORS setup and no separate web server.

### Request workflow

1. The user pastes code or uploads a file in the UI, which sends it to `POST /api/analyze`.
2. The backend checks the request and the API key, then writes the code to a **temporary `.py` file** so Semgrep has a real path to scan.
3. It starts the **Semgrep MCP server** as a subprocess (`semgrep mcp`) and creates the **Security Researcher** agent with that server attached.
4. The agent calls `semgrep_scan` **once** with `config: "auto"`, reviews the findings, and then runs its own review to find issues Semgrep missed.
5. The agent returns a typed `SecurityReport`. The backend sorts the issues by CVSS score (highest first), adds a summary prefix, deletes the temp file and returns the JSON.
6. The UI shows a summary and a table of issues, each with a severity badge, the vulnerable code snippet and a suggested fix.

---

## How the app uses AI

### OpenAI Agents SDK
The backend uses the [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) (`openai-agents`) rather than calling the Chat Completions API directly. The SDK runs the tool-calling loop: the model decides when to call Semgrep, gets the results, and continues until it produces a final answer.

```python
Agent(
    name="Security Researcher",
    instructions=SECURITY_RESEARCHER_INSTRUCTIONS,
    model="gpt-4.1-mini",
    mcp_servers=[semgrep_server],
    output_type=SecurityReport,
)
```

Each run is wrapped in `trace("Security Researcher")`, so you can inspect the full run (model calls, tool calls, timings) in the [OpenAI Traces dashboard](https://platform.openai.com/traces).

### Structured output
`output_type=SecurityReport` makes the model return JSON that matches a **Pydantic** schema instead of free text:

```python
class SecurityIssue(BaseModel):
    title: str
    description: str
    code: str          # vulnerable snippet
    fix: str           # recommended remediation
    cvss_score: float  # 0.0 – 10.0
    severity: str      # critical | high | medium | low

class SecurityReport(BaseModel):
    summary: str
    issues: List[SecurityIssue]
```

The field descriptions are part of the schema the model sees. FastAPI uses the same model as the endpoint's `response_model`, so the backend never has to parse or regex the model's text, and the frontend gets a stable, typed contract.

### MCP (Model Context Protocol)
Semgrep is connected to the agent through an **MCP server** (`MCPServerStdio`) instead of a hand-written function tool:

- The server runs as a child process (`semgrep mcp`) and talks to the agent over stdio. `SEMGREP_APP_TOKEN` is passed to it in its environment.
- A **static tool filter** exposes only `semgrep_scan`, so the model can't wander into Semgrep's other tools.
- `client_session_timeout_seconds=240` gives the scan time to load the rule registry, which is slow on a cold start.

### Prompt engineering
[backend/context.py](backend/context.py) holds the system prompt. It sets firm limits to keep runs fast and predictable:
- Use `config: "auto"` and nothing else (the model otherwise tends to invent rule-set names).
- Call `semgrep_scan` **once**, and don't repeat it.
- Report findings as "Semgrep found X issues, and I identified Y additional issues", with no duplicates between the two sources.

---

## Sample vulnerable file: `issues.py`

[issues.py](issues.py) at the repo root contains **intentional security issues**. Paste or upload it to get a meaningful report straight away. It's a small airline-booking chatbot (Gradio + Agents SDK) that includes:

- **SQL injection**: queries are built with f-strings from user and model input (`SELECT price FROM prices WHERE city = '{city}'`).
- **Arbitrary code execution**: a "calculator" tool passes model-controlled input to `eval()`.
- **Information disclosure**: full stack traces are returned to the caller.

> ⚠️ Don't deploy or expose `issues.py`. It's a test fixture, not part of the app.

---

## Prerequisites

| Tool | Needed for |
|---|---|
| [uv](https://docs.astral.sh/uv/) | Backend (local) |
| Node.js 20+ and npm | Frontend (local) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Docker, Azure, GCP |
| [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.0 | Azure, GCP |
| [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) | Azure |
| [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`) | GCP |

API keys:
- **OpenAI API key**: <https://platform.openai.com/api-keys>
- **Semgrep App Token**: create a free account at <https://semgrep.dev>, then go to *Settings → Tokens*.

Copy `.env.example` to `.env` in the repo root and fill in both values:

```bash
OPENAI_API_KEY=sk-...
SEMGREP_APP_TOKEN=...
```

---

## Run locally (development)

Open two terminals from the repo root.

**Backend:** <http://localhost:8000>
```bash
cd backend
uv run server.py
```

**Frontend:** <http://localhost:3000>
```bash
cd frontend
npm install   # first time only
npm run dev
```

Open <http://localhost:3000> and analyze `issues.py`. In development the frontend calls `http://localhost:8000` directly.

## Run locally (Docker)

```bash
docker build -t cyber-analyzer .
docker run --rm -d --name cyber-analyzer -p 8000:8000 --env-file .env cyber-analyzer
```

Open <http://localhost:8000>. Useful commands:

```bash
docker logs -f cyber-analyzer   # follow logs
docker stop cyber-analyzer      # stop (the container is removed because of --rm)
```

---

## Deploy to Azure (Container Apps)

Terraform creates an **Azure Container Registry**, builds and pushes the image, and deploys it to **Azure Container Apps** (1 vCPU, 2 GiB, scales to zero) with a **Log Analytics** workspace.

1. **Log in and register providers** (one-time setup):
   ```bash
   az login
   az provider register --namespace Microsoft.App
   az provider register --namespace Microsoft.OperationalInsights
   ```
2. **Create the resource group.** Terraform expects it to exist already:
   ```bash
   az group create --name cyber-analyzer-rg --location eastus
   ```
3. **Load your keys and deploy:**
   ```bash
   export $(cat .env | xargs)      # macOS / Linux / WSL
   cd terraform/azure
   terraform init
   terraform workspace new azure   # or: terraform workspace select azure
   terraform apply \
     -var="openai_api_key=$OPENAI_API_KEY" \
     -var="semgrep_app_token=$SEMGREP_APP_TOKEN"
   terraform output app_url
   ```
   <details><summary>Windows PowerShell</summary>

   ```powershell
   Get-Content .env | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
   cd terraform/azure
   terraform init
   terraform workspace new azure
   terraform apply -var ("openai_api_key=" + $Env:OPENAI_API_KEY) -var ("semgrep_app_token=" + $Env:SEMGREP_APP_TOKEN)
   ```
   </details>

4. **Logs:**
   ```bash
   az containerapp logs show --name cyber-analyzer --resource-group cyber-analyzer-rg --follow
   ```
5. **Tear down** when you're done, to avoid charges:
   ```bash
   terraform destroy -var="openai_api_key=$OPENAI_API_KEY" -var="semgrep_app_token=$SEMGREP_APP_TOKEN"
   ```

## Deploy to GCP (Cloud Run)

Terraform enables the required APIs, creates an **Artifact Registry** repository, builds and pushes the image, and deploys it to **Cloud Run** (1 vCPU, 2 GiB, scales to zero, public URL).

1. **Create or select a project** with billing enabled, then authenticate:
   ```bash
   export TF_VAR_project_id="your-project-id"
   gcloud auth login
   gcloud config set project $TF_VAR_project_id
   gcloud auth application-default login
   gcloud auth application-default set-quota-project $TF_VAR_project_id
   gcloud auth configure-docker
   ```
2. **Deploy:**
   ```bash
   export $(cat .env | xargs)
   cd terraform/gcp
   terraform init
   terraform workspace new gcp     # or: terraform workspace select gcp
   terraform apply \
     -var="openai_api_key=$OPENAI_API_KEY" \
     -var="semgrep_app_token=$SEMGREP_APP_TOKEN"
   terraform output service_url
   ```
3. **Logs:**
   ```bash
   gcloud run services logs read cyber-analyzer --region=us-central1
   ```
4. **Tear down:**
   ```bash
   terraform destroy -var="openai_api_key=$OPENAI_API_KEY" -var="semgrep_app_token=$SEMGREP_APP_TOKEN"
   ```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `failed to connect to the docker API at unix:///var/run/docker.sock` | Docker Desktop isn't running. Start it. On WSL, also turn on *Settings → Resources → WSL Integration* for your distro. |
| `error getting credentials - err: exit status 1` | `~/.docker/config.json` contains `"credsStore": "desktop.exe"` but you aren't logged in to Docker Hub. Remove that line, or run `docker login`. |
| Terraform: `Error running legacy build ... unpigz ... invalid deflate data` | The Terraform Docker provider's legacy builder sends a corrupt build context on recent Docker versions. The `build` blocks here already set `builder = "default"` and a full `dockerfile` path to avoid this. |
| Semgrep process killed (exit `-9`) in the cloud | Not enough memory. The Semgrep rule registry needs **≥ 2 GiB**, which both Terraform configs already allocate. |
| Code changes don't show up after `terraform apply` | The Docker provider doesn't detect source changes. Run `terraform taint docker_image.app` and `terraform taint docker_registry_image.app`, then apply again. You can also change `docker_image_tag`. |
| `terraform apply` fails with an image or architecture error on Apple Silicon | The build already targets `linux/amd64`. Make sure Docker Desktop is up to date and Rosetta emulation is turned on. |

---

## Project structure

```
.
├── backend/            FastAPI app, agent, prompts, MCP config (uv project)
├── frontend/           Next.js UI (static export)
├── terraform/
│   ├── azure/          Container Apps + ACR + Log Analytics
│   └── gcp/            Cloud Run + Artifact Registry
├── assets/             Images
├── issues.py           Intentionally vulnerable sample for testing
├── Dockerfile          Multi-stage build: Next.js → FastAPI runtime
└── .env.example        Template for OPENAI_API_KEY / SEMGREP_APP_TOKEN
```
