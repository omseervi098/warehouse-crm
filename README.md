# Warehouse CRM 

Warehouse CRM is a desktop application built to streamline warehouse management, stock tracking, billing, and report generation. The project leverages Electron and React to deliver a cross-platform desktop experience with a modern interface.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Electron, Node.js
- **Database:** MongoDB (via Mongoose)
- **PDF Generation:** jsPDF, jsPDF-AutoTable
- **Build/Dist:** Electron Builder

## Prerequisites

- Node.js (v20+)
- MongoDB (Local instance or Atlas connection string)

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run carefully in development mode**
   ```bash
   npm run dev
   ```
   This will concurrently start the Vite React development server and the Electron application.

3. **Database Configuration**
   Upon first launch, the application will prompt you to enter your MongoDB connection string on the Setup page.

## Available Scripts

- `npm run dev`: Starts the application in development mode.
- `npm run build`: Builds the React frontend.
- `npm run dist:win`: Builds and packages the app as an executable for Windows (`.exe` / NSIS installer).
- `npm run dist:mac`: Builds and packages the app for macOS (`.dmg`).
- `npm run dist:linux`: Builds and packages the app for Linux (`.AppImage`).

## Features

- **Stock Management:** Add, edit, and check real-time stock balances per party and unit type.
- **Reporting & Billing:** Generate detailed PDF reports for bills, history, gatepasses, and charges via dynamic PDF building.
- **Dynamic Configuration:** SMTP and Database details are configured dynamically via the UI setup or app settings rather than hardcoded environment variables.
- **Company Profile:** Highly customizable company branding including name, address, and logo for exported files.
