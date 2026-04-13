# Local Development Setup

## Frontend Development

### Starting the Frontend

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:4001
   - The page will automatically reload when you make changes

### Environment Variables

The frontend is configured to automatically detect the API URL:
- **Default**: `http://localhost:4000/api`
- **Custom**: Set `NEXT_PUBLIC_API_URL` environment variable

To use a custom API URL:
```bash
# Windows PowerShell
$env:NEXT_PUBLIC_API_URL="http://localhost:4000/api"
npm run dev

# Windows CMD
set NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev

# Linux/Mac
NEXT_PUBLIC_API_URL=http://localhost:4000/api npm run dev
```

### Backend Connection

The frontend expects the backend API to be running on:
- **URL**: `http://localhost:4000/api`
- **Health Check**: `http://localhost:4000/health`

If the backend is not running, you'll see connection errors in the browser console.

### Available Scripts

- `npm run dev` - Start development server (port 4001)
- `npm run build` - Build for production
- `npm run start` - Start production server (port 4001)
- `npm run lint` - Run ESLint
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e:ui` - Run e2e tests with UI

### Troubleshooting

#### Port Already in Use
If port 4001 is already in use:
```bash
# Find process using port 4001
netstat -ano | findstr :4001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

#### API Connection Errors
- Ensure backend is running on port 4000
- Check `NEXT_PUBLIC_API_URL` environment variable
- Check browser console for CORS errors

#### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Testing Your Changes

After making changes (like the "Psikotest" typo fix):

1. The dev server will automatically reload
2. Open http://localhost:4001 in your browser
3. Navigate to a Position page
4. Click "Detail" on any position
5. Check the "Current Status" field - should show "Psikotest & Technical Test"

### Hot Reload

The Next.js dev server supports hot module replacement (HMR):
- Changes to React components update instantly
- No need to refresh the page
- State is preserved during updates

