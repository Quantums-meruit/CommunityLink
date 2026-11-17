# Frontend architecture

React components are organized into layout, common components, forms, routes, context, services and pages. `AuthContext` loads the current session and exposes login/register/logout. Axios uses a single credentialed API instance configured by `VITE_API_URL`. Protected routes gate authenticated and administrator pages.
