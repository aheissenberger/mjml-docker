# API Reference

Base URL: `http://localhost:3000` (configurable via `PORT` environment variable)

All endpoints except `GET /health` require bearer token authentication.

---

## Authentication

Protected endpoints require the following header:

```
Authorization: Bearer <API_KEY>
```

`API_KEY` is set via the environment variable of the same name. A missing, empty, or incorrect token returns **401 Unauthorized**.

---

## Endpoints

### GET /health

Health check. No authentication required.

**Request**

```
GET /health
```

**Response — 200 OK**

```json
{ "status": "ok" }
```

**Example**

```bash
curl http://localhost:3000/health
```

---

### GET /

Returns server info and the list of available endpoints.

**Request**

```
GET /
Authorization: Bearer <API_KEY>
```

**Response — 200 OK**

```json
{
  "name": "node25-ts-api-server",
  "message": "API server is running",
  "endpoints": ["/health", "POST /v1/render"]
}
```

**Error responses**

| Status | Body                            | Condition                                 |
| ------ | ------------------------------- | ----------------------------------------- |
| 401    | `{ "message": "Unauthorized" }` | Missing or invalid `Authorization` header |

**Example**

```bash
curl http://localhost:3000/ \
  -H "Authorization: Bearer your-secret-api-key"
```

---

### POST /v1/render

Renders an MJML template to a responsive HTML email.

**Request**

```
POST /v1/render
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**Request body**

| Field     | Type   | Required | Description                                  |
| --------- | ------ | -------- | -------------------------------------------- |
| `mjml`    | string | Yes      | Valid MJML markup to render                  |
| `options` | object | No       | Optional render options (allowlisted subset) |

```json
{
  "mjml": "<mjml><mj-body>...</mj-body></mjml>",
  "options": {
    "fonts": {
      "Acme": "https://example.com/acme.css"
    },
    "keepComments": false,
    "minify": true
  }
}
```

`options` allowlist:

| Field          | Type                    | Description                                                          |
| -------------- | ----------------------- | -------------------------------------------------------------------- |
| `fonts`        | `Record<string,string>` | Custom font imports passed to MJML                                   |
| `keepComments` | boolean                 | Forwards MJML's `keepComments` flag                                  |
| `minify`       | boolean                 | Applies post-render HTML/CSS minification using a safe server config |

**Response — 200 OK**

| Field    | Type   | Description                                             |
| -------- | ------ | ------------------------------------------------------- |
| `html`   | string | Fully rendered HTML email                               |
| `errors` | array  | MJML validation warnings (empty when template is clean) |

Each item in `errors`:

| Field     | Type   | Description                             |
| --------- | ------ | --------------------------------------- |
| `tagName` | string | The MJML tag that triggered the warning |
| `message` | string | Human-readable description of the issue |
| `line`    | number | Line number in the submitted MJML       |

```json
{
  "html": "<!doctype html><html xmlns:v=\"urn:schemas-microsoft-com:vml\" ...>...</html>",
  "errors": []
}
```

A 200 response is returned even when `errors` is non-empty. Errors represent MJML validation warnings that do not prevent rendering.

**Error responses**

| Status | Body                                                                   | Condition                                              |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 401    | `{ "message": "Unauthorized" }`                                        | Missing or invalid `Authorization` header              |
| 422    | `{ "message": "Failed to read request body" }`                         | Request body could not be read                         |
| 422    | `{ "message": "Invalid JSON body" }`                                   | Body is not valid JSON                                 |
| 422    | `{ "message": "Missing or invalid \"mjml\" field: must be a string" }` | `mjml` field is absent or not a string                 |
| 422    | `{ "message": "Invalid \"options\" field: ..." }`                      | `options` contains unknown keys or invalid value types |

**Examples**

Minimal template:

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mjml": "<mjml><mj-body><mj-section><mj-column><mj-text>Hello!</mj-text></mj-column></mj-section></mj-body></mjml>"
  }'
```

```json
{
  "html": "<!doctype html><html xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">...</html>",
  "errors": []
}
```

Template with minified output:

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mjml": "<mjml><mj-body><mj-section><mj-column><mj-text>Hello!</mj-text></mj-column></mj-section></mj-body></mjml>",
    "options": {
      "minify": true
    }
  }'
```

Template with a validation warning (unknown attribute):

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mjml": "<mjml><mj-body><mj-section unknown-attr=\"1\"><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>"
  }'
```

```json
{
  "html": "<!doctype html>...</html>",
  "errors": [
    {
      "tagName": "mj-section",
      "message": "Attribute unknown-attr is illegal",
      "line": 1
    }
  ]
}
```

Missing `mjml` field:

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "message": "Missing or invalid \"mjml\" field: must be a string"
}
```

---

### All other routes — 404 Not Found

```json
{ "message": "Not found" }
```

---

## Error code summary

| Status | Meaning                                              |
| ------ | ---------------------------------------------------- |
| 200    | Success (HTML rendered; check `errors` for warnings) |
| 401    | Unauthorized — missing or invalid bearer token       |
| 404    | Route not found                                      |
| 422    | Unprocessable request body                           |

---

## Environment variables

| Variable  | Required | Default | Description                                                                                   |
| --------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `API_KEY` | Yes      | —       | Bearer token for all authenticated endpoints. The server exits at startup if this is not set. |
| `PORT`    | No       | `3000`  | TCP port the server listens on                                                                |
