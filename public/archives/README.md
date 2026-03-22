# Public Archives

Drop exported transmission `.json` (or `.json.gz`) files here and add a corresponding entry to `manifest.json` to include them in the public library.

## manifest.json format

Each entry must match the `CloudManifestItem` shape:

```json
[
  {
    "id": "abc123",
    "title": "Neo-Tokyo 2099",
    "summary": "A city drowning in corporate shadow wars...",
    "filename": "abc123.json",
    "createdAt": 1700000000000
  }
]
```

`manifest.json` itself is tracked by git; individual transmission files (`.json`, `.json.gz`) are gitignored by default.
