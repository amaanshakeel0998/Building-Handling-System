# Building Handling System

A lightweight web app for configuring buildings, floors, and rooms, then rendering a 3D campus-style view in the browser. Data is stored locally in the browser (localStorage) and the UI is optimized for quick setup and visualization.

## Features
- Create multiple buildings (1 to 10) and assign custom names
- Configure floors per building
- Add rooms with capacity, schedule, teacher, subject, semester, and department
- Persist data in the browser with localStorage
- Interactive 3D visualization using Three.js with orbit controls

## Tech Stack
- Frontend: HTML, CSS, JavaScript, Bootstrap 5
- 3D: Three.js
- Optional dev server: Flask (Python)

## Quick Start

### Option A: Open as a static site
1. Open `index.html` directly in a browser.

### Option B: Run with Flask (recommended for local development)
1. Create and activate a virtual environment.
2. Run the app:

```bash
python3 app.py
```

3. Visit `http://127.0.0.1:5000` in your browser.

## Usage
1. Go to the `Data Input` view.
2. Set the number of buildings and click `Setup Buildings`.
3. Assign building names and floors.
4. Add rooms with schedule and metadata.
5. Switch to `View Buildings` to generate the 3D scene.

## Project Structure
```
Building-Handling-System/
├─ app.py
├─ index.html
├─ script.js
├─ style.css
└─ vercel.json
```

- `app.py` - Flask server to serve the static files
- `index.html` - Main UI and layout
- `style.css` - Styling
- `script.js` - Application logic and 3D rendering
- `vercel.json` - Static deployment configuration

## Data Persistence
All data is stored in your browser using localStorage. There is no backend database in this project.

## Deployment
This project includes a `vercel.json` configured for static hosting. You can deploy it as a static site on Vercel or any static host.

## License
Add your license here.
