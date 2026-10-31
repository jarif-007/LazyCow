## 📁 Repository Structure

```text
LazyCow/
├── code/                        # Main desktop application source tree
│   ├── electron/
│   │   ├── main.ts              # Electron main process (Windows execution engine & APIs)
│   │   ├── preload.ts           # Secure IPC contextBridge exposure
│   │   ├── windowLayout.ts      # C# P/Invoke window snapping engine
│   │   └── preferences.ts       # Hardware acceleration config
│   ├── src/
│   │   ├── components/          # React components (ActionSequence, WindowLayout, etc.)
│   │   ├── hooks/               # Custom React hooks (useHotkeyRecorder, useDragSelect)
│   │   ├── pages/               # Pages (Library, Builder, Settings, Account)
│   │   ├── types/               # Action catalogs & TypeScript data models
│   │   └── utils/               # Cloud sync, disk mirroring, safety classifiers
│   ├── public/                  # Static assets
│   ├── scripts/                 # Utility scripts
│   ├── .eslintrc.cjs            # ESLint configuration
│   ├── .gitignore               # Git ignore rules
│   ├── boot.bat                 # Boot script
│   ├── electron-builder.json5   # Installer configuration
│   ├── index.html               # Main HTML file
│   ├── jsconfig.json            # JS config
│   ├── package.json             # Scripts and dependencies
│   ├── postcss.config.js        # PostCSS config
│   ├── tailwind.config.js       # Tailwind config
│   ├── tsconfig.json            # TypeScript config
│   ├── tsconfig.node.json       # Node TypeScript config
│   └── vite.config.ts           # Vite + Electron build configuration
├── doc/                         # Project presentations & SRS documents
│   ├── Final Presentation.pdf
│   ├── Group 8 (SPL - SRS) Presentation.pdf
│   ├── Group 8 [109, 142, 147, 152].pdf
│   ├── Proposal Presentation.pdf
│   └── SRS User Story_ SPL Group 8.pdf
└── README.md                    # Project README
