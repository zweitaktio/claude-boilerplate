---
version: 1.1.0
applies: Always
target: rules
priority: high
tags: [monorepo, directory]
---

# Monorepo: Change Directory First

When starting a task, identify which part of the monorepo it belongs to and `cd` there before doing anything else.

```bash
# Frontend task → cd frontend first
cd frontend

# Backend task → cd backend first
cd backend
```

Each directory is autonomous with its own `package.json`, dependencies, and scripts. There is no shared workspace — treat each as an independent project.

**First action on any task:** `cd` into the relevant directory.
