# Copilot Instructions for AI Coding Agents

## Project Overview
This is a Node.js/Express web application for peer-to-peer tutoring and video sharing. The architecture is organized by major functional areas:
- **Models (`models/`)**: Mongoose schemas for users, tutors, messages, videos, and profiles.
- **Routes (`routes/`)**: Express routers for authentication, chat, admin, tutor, and video features.
- **Middleware (`middleware/`)**: Custom Express middleware, e.g., authentication logic.
- **Views (`views/`)**: EJS templates for all UI pages (dashboard, chat, profile, video upload, etc.).
- **Public (`public/`)**: Static assets (JS, images, uploads, videos).
- **Entry Point (`app.js`)**: Main Express app setup, middleware registration, and route mounting.

## Key Patterns & Conventions
- **Authentication**: Custom middleware in `middleware/authMiddleware.js` protects routes and manages user sessions.
- **Data Models**: All persistent data is managed via Mongoose models in `models/`. Each model file defines a schema and exports the model.
- **Routing**: Route files in `routes/` are mounted in `app.js`. Each route file handles a specific domain (e.g., `chat.js` for messaging).
- **Views**: EJS templates in `views/` are rendered by route handlers. UI logic is separated from backend logic.
- **Static Files**: Uploaded videos and images are stored in `public/uploads/` and `public/videos/`. Thumbnails are in `public/thumbnails/`.

## Developer Workflows
- **Start Server**: Run `node app.js` from the project root.
- **No explicit build step**: This is a pure Node.js app; changes are live on restart.
- **No test suite detected**: Add tests in a `tests/` folder if needed; none present by default.
- **Debugging**: Use `console.log` or Node.js debuggers. Check `app.js` for middleware and error handling.

## Integration Points
- **MongoDB**: All models use Mongoose for MongoDB integration. Connection setup is typically in `app.js`.
- **Session Management**: Likely uses Express sessions (check `app.js` for details).
- **File Uploads**: Handled via routes and stored in `public/uploads/`.

## Project-Specific Advice
- When adding new features, follow the existing pattern: create a model (if needed), add a route, update views, and register in `app.js`.
- For authentication, always use the middleware in `middleware/authMiddleware.js`.
- For new static assets, place them in the appropriate subfolder under `public/`.
- For UI changes, update the relevant EJS template in `views/`.

## Example: Adding a New Video Feature
1. Create a new Mongoose model in `models/Video.js`.
2. Add a route in `routes/video.js` for upload/view logic.
3. Update or add EJS templates in `views/uploadvideo.ejs` and `views/viewcource.ejs`.
4. Register the route in `app.js`.
5. Store uploaded files in `public/uploads/` and `public/videos/`.

## References
- `app.js`: Main application setup and route mounting.
- `models/`: Data schemas.
- `routes/`: API and page logic.
- `views/`: UI templates.
- `middleware/authMiddleware.js`: Authentication logic.

---
For unclear or missing conventions, ask the user for clarification before making structural changes.