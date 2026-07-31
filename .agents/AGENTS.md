# Project Rules

## API Calls Pattern
All API calls in the frontend must follow this pattern:
1. Import `API_BASE` from the config file:
   ```javascript
   import API_BASE from "./config";
   ```
2. Make fetch requests using `API_BASE` with the required authorization headers:
   ```javascript
   const res = await fetch(`${API_BASE}/admin/users`, {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });
   ```
