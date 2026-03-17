# UrbanPOS - Modern Point of Sale

UrbanPOS is a feature-rich, responsive, and installable Point of Sale (POS) application built with a modern tech stack. It's designed to be a fast, efficient, and user-friendly solution for small to medium-sized businesses to manage sales, inventory, and customer promotions.

## ✨ Features

*   **Intuitive POS Interface**: A clean and fast interface for processing transactions.
*   **Dynamic Product Grid**: Easily search and filter products by category.
*   **Inventory Management**: Full CRUD (Create, Read, Update, Delete) functionality for products and categories.
*   **Sales Dashboard**: A real-time overview of key business metrics like total revenue, sales volume, and monthly performance.
*   **Detailed Sales History**: Browse and review past transactions with expandable details for each sale.
*   **Coupon System**: Create and manage percentage-based or fixed-amount promotional coupons.
*   **Secure Access Control**: Utilizes a multi-level key system (master keys and permission-based keys) for secure access.
*   **Email Receipts**: Send beautifully formatted HTML email receipts to customers.
*   **Progressive Web App (PWA)**: Fully installable on any desktop or mobile device for a native app-like experience with offline capabilities.
*   **Responsive Design**: A mobile-first design that works seamlessly on any screen size.
*   **Theming**: Styled with CSS variables for easy theme customization.

## 🚀 Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (using the App Router)
*   **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore) for real-time data storage.
*   **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth) for secure, session-based anonymous login.
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
*   **UI Components**: Built with [ShadCN UI](https://ui.shadcn.com/), a collection of accessible and reusable components.
*   **Form Management**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) for validation.
*   **PWA**: Configured with `@ducanh2912/next-pwa`.

## ⚙️ Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   npm or yarn
*   A Firebase project

### 1. Environment Variables

This project requires an SMTP server configuration to send email receipts. Create a `.env.local` file in the root of the project and add your SMTP credentials:

```bash
# .env.local

# SMTP Configuration for sending email receipts
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=your_sending_email_address
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 3. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

### 4. Logging In

The application is protected by an access key system.
*   **Super Master Key**: A hardcoded master key `726268` provides full access. This should be changed for production use.
*   **Custom Keys**: You can create custom master keys or keys with specific page permissions from the **Settings > Access Keys** page after logging in with a master key.

## 📁 Project Structure

```
.
├── src
│   ├── app
│   │   ├── (dashboard)       # Authenticated routes and layout
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── pos/
│   │   │   ├── sales/
│   │   │   └── settings/
│   │   ├── login/            # Login page
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Root page (redirects to /pos)
│   ├── components
│   │   ├── ui/               # ShadCN UI components
│   │   └── ...               # Custom application components
│   ├── firebase
│   │   ├── config.ts         # Firebase project configuration
│   │   ├── index.ts          # Firebase initialization and hooks
│   │   └── ...
│   ├── hooks
│   │   ├── use-authorization.tsx # Hook for checking page permissions
│   │   └── ...
│   └── lib
│       ├── data.ts           # TypeScript type definitions
│       └── utils.ts          # Utility functions
├── public
│   ├── icons/              # PWA icons
│   └── manifest.json       # PWA manifest file
├── docs
│   └── backend.json        # Defines the data structures for Firestore
└── ...                     # Config files (tailwind, next, etc.)
```

## 📦 PWA (Progressive Web App)

This application is a fully-featured PWA.

*   **Installability**: On a supported browser (like Chrome), you will see an "Install" icon in the address bar. Clicking it will install the app to your device's home screen or applications folder.
*   **Offline Access**: The service worker caches application assets, allowing it to load even without an internet connection (though Firestore data fetching will require a connection).
