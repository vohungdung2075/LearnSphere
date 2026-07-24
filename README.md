# LearnSphere

LearnSphere là nền tảng học tập trực tuyến gồm frontend React/Vite và backend Express/MongoDB. Ứng dụng hỗ trợ đăng ký, đăng nhập, quản lý khóa học, bài học, quiz, tiến độ học tập, phân quyền người dùng và upload/download file qua S3.

## Cấu trúc dự án

```text
LearnSphere/
+-- LearnSphere_BE/   # Backend API: Express, MongoDB, JWT, S3, email
`-- LearnSphere_FE/   # Frontend: React, TypeScript, Vite, Tailwind CSS
```

## Yêu cầu

- Node.js 20.19+
- npm
- MongoDB local hoặc MongoDB Atlas
- AWS S3 bucket nếu dùng chức năng upload file

## Chạy backend local

```bash
cd LearnSphere_BE
npm install
```

Sao chép `.env.example` thành `.env`; khi chạy local đặt:

```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
TRUST_PROXY=false
MONGODB_REQUIRE_TRANSACTIONS=false
```

Chạy server:

```bash
npm run dev
```

Backend mặc định chạy tại:

```text
http://localhost:5000
```

## Chạy frontend local

```bash
cd LearnSphere_FE
npm install
```

Vite đã proxy `/api` sang backend local. Có thể bỏ trống file `.env` frontend hoặc đặt:

```env
VITE_API_BASE_URL=/api
```

Chạy ứng dụng:

```bash
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

## Build production

Backend:

```bash
cd LearnSphere_BE
npm start
```

Frontend:

```bash
cd LearnSphere_FE
npm run build
npm run preview
```

## Ghi chú

- Backend sẽ dừng khi thiếu `MONGODB_URI`, `AWS_REGION` hoặc `AWS_S3_BUCKET`.
- Các biến `EMAIL` và `EMAIL_PASSWORD` được dùng cho chức năng quên mật khẩu.
- Nếu dùng Gmail, nên tạo App Password thay vì dùng mật khẩu tài khoản chính.
