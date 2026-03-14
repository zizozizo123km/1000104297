# 🎓 Bac DZ AI

> منصة تعليمية متكاملة لتلاميذ البكالوريا الجزائرية مدعومة بالذكاء الاصطناعي

---

## 🚀 النشر على Vercel (تلقائي)

### خطوة واحدة فقط:
```bash
npx vercel --prod
```

Vercel يقوم تلقائياً بـ:
1. ✅ `npm install` — تثبيت dependencies الـ Frontend
2. ✅ `cd server && npm install` — تثبيت Socket.io Server
3. ✅ `npm run build` — بناء الـ React app
4. ✅ نشر `api/socket.js` كـ Serverless Function
5. ✅ نشر `dist/` كـ Static Files

---

## 💻 تشغيل محلي

### 1. تشغيل الـ Frontend:
```bash
npm install
npm run dev
# http://localhost:5173
```

### 2. تشغيل Socket.io Server:
```bash
cd server
npm install
node index.js
# 🚀 Running on http://localhost:3001
# 🏥 Health: http://localhost:3001/health
```

---

## 📁 هيكل المشروع

```
bac-dz-ai/
├── 📄 .gitignore
├── 📄 .env.example
├── 📄 README.md
├── 📄 components.json
├── 📄 eslint.config.js
├── 📄 index.html
├── 📄 package.json
├── 📄 postcss.config.js
├── 📄 tailwind.config.ts
├── 📄 tsconfig.app.json
├── 📄 tsconfig.json
├── 📄 tsconfig.node.json
├── 📄 vercel.json          ← إعدادات Vercel
├── 📄 vite.config.ts
│
├── api/
│   └── socket.js           ← Vercel Serverless Socket.io
│
├── server/
│   ├── index.js            ← Socket.io Server (local dev)
│   └── package.json
│
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── lib/
    │   ├── firebase.ts
    │   ├── gemini.ts
    │   ├── openrouter.ts
    │   └── socket.ts       ← Socket.io Client
    ├── context/
    │   └── AppContext.tsx
    └── pages/
        ├── HomePage.tsx
        ├── AuthPage.tsx
        ├── ChatPage.tsx
        ├── PostsPage.tsx
        ├── AITeacherPage.tsx
        ├── AnalyzerPage.tsx
        ├── YouTubePage.tsx
        ├── SearchPage.tsx
        ├── ZoomRoomPage.tsx ← WebRTC + Socket.io
        ├── ProfilePage.tsx
        └── AdminPage.tsx
```

---

## ⚙️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|----------|
| **React + TypeScript** | Frontend |
| **Vite** | Build Tool |
| **Tailwind CSS** | Styling |
| **Firebase Auth** | تسجيل الدخول |
| **Firestore** | قاعدة البيانات |
| **Firebase RTDB** | الدردشة المباشرة |
| **Socket.io** | WebRTC Signaling |
| **WebRTC** | مكالمات الفيديو |
| **Gemini 3 Flash** | الذكاء الاصطناعي |
| **YouTube Data API** | البحث عن دروس |
| **Vercel** | الاستضافة |

---

## 🔑 حساب المسؤول

```
Email: nacero123@gmail.com
Password: adminadmin
```

---

## 🌐 المتغيرات البيئية

```env
# اختياري — يُكتشف تلقائياً في Vercel
VITE_SOCKET_URL=https://your-app.vercel.app
```
