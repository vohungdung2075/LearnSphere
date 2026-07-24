# LearnSphere pre-deploy hardening — 2026-07-24

Tài liệu này ghi lại các thay đổi được thực hiện sau lần audit toàn dự án trước khi deploy.

## 1. Quiz và enrollment

### Snapshot đề theo từng attempt

- `QuizAttempt.question_snapshot` lưu câu hỏi, loại câu, điểm và đáp án ngay lúc bắt đầu.
- API trả đề cho học viên luôn loại bỏ `is_correct`.
- Khi submit, backend chấm theo snapshot của attempt thay vì đọc Quiz hiện tại.
- Attempt cũ chưa có snapshot được backfill một lần khi resume/submit để tương thích dữ liệu trước đây.

### Chống thao tác đồng thời

- Quiz có cờ nội bộ `accepting_attempts`; xóa quiz khóa nhận attempt mới trước khi kiểm tra.
- Start quiz kiểm tra lại quiz và enrollment sau khi tạo attempt. Nếu trạng thái đã thay đổi, attempt vừa tạo được xóa.
- Không cho học viên unenroll khi còn attempt `in_progress` chưa hết hạn.
- Approve/reject enrollment dùng thao tác MongoDB atomic với điều kiện `status: pending`; chỉ request thắng mới gửi notification.

### Tutor bị khóa

- Course của tutor có `account_status != active` không còn xuất hiện trong catalog, không cho enroll và không cho student truy cập lesson, discussion, quiz, AI hay URL tải file.
- Quyền admin xem và quyền tutor sở hữu vẫn được kiểm tra riêng; admin không được cấp quyền chỉnh sửa quiz/course.

## 2. S3 cleanup và multipart

### Xóa file cũ có retry

- Primitive xóa S3 được tách sang `s3-storage.service.js` để tránh import vòng.
- Nếu xóa thumbnail/video/document/avatar cũ thất bại, backend tạo `S3CleanupTask` bền vững thay vì chỉ ghi log.
- Scheduler claim task atomic, retry theo exponential backoff và lưu context/lỗi gần nhất.

### Multipart idempotent

- Complete multipart claim `UploadSession` atomic bằng trạng thái processing.
- Request complete đồng thời nhận `UPLOAD_COMPLETION_IN_PROGRESS` hoặc kết quả đã hoàn tất, không gọi CompleteMultipartUpload chồng nhau.
- Nếu AWS trả `NoSuchUpload`, backend dùng `HeadObject` kiểm tra chính xác size/content-type để nhận ra lần complete trước đã thành công.
- Abort không chen vào complete đang chạy và không xóa object đã được Course/Lesson/User tham chiếu.
- Session attached được giữ thêm một khoảng ngắn để confirm/complete retry vẫn idempotent; cleanup worker sau đó đối chiếu reference.

AWS vẫn cần:

- IAM `s3:AbortMultipartUpload`.
- Bucket CORS `ExposeHeaders: ["ETag"]`.
- Lifecycle `AbortIncompleteMultipartUpload` sau khoảng một ngày.

## 3. AI và OCR

- Tóm tắt AI dùng `ai_summary_run_id`, trạng thái processing và stale timeout để hai request không cùng tiêu quota.
- Kết quả chỉ được lưu nếu document key và run ID vẫn đúng; đổi document trong lúc xử lý trả `AI_SUMMARY_SOURCE_CHANGED`.
- AI rate limit chuyển từ Map trong RAM sang fixed-window counter atomic trong MongoDB, nên không reset khi restart và hoạt động với nhiều instance.
- Log provider giữ thêm thông tin lỗi fallback để phân biệt Bedrock lỗi với Groq fallback lỗi.
- Cleanup Tesseract worker và PDF parser có deadline riêng, tránh request treo vô thời hạn trong `finally`.
- `.env.example` đã bổ sung toàn bộ Bedrock, Groq, OCR, context, timeout và rate-limit variables.

## 4. Authentication và backend security

- JWT frontend chuyển khỏi `localStorage` sang cookie `HttpOnly`.
- Production cookie có `Secure`, `SameSite=Lax`; frontend gọi API với `credentials: include`.
- Bearer token vẫn được backend chấp nhận để tương thích API client ngoài trình duyệt.
- Thêm `POST /api/auth/logout` để xóa cookie.
- Mật khẩu mới tối thiểu 6 ký tự.
- Login/register/forgot/reset có rate limit riêng.
- Thêm Helmet, CORS allowlist từ `FRONTEND_URL`, JSON limit 1 MB, JSON 404 và global error handler.
- `TRUST_PROXY=true` chỉ dùng khi backend đứng sau đúng một CloudFront/ALB/reverse proxy.

Lưu ý migration: phiên cũ lưu trong localStorage sẽ bị frontend xóa. Người dùng có thể phải đăng nhập lại một lần.

## 5. Monitoring và database

- `/health/live` kiểm tra process Express.
- `/health/ready` chỉ trả 200 khi Mongoose đang connected; Docker và workflow dùng endpoint này.
- Startup có thể bắt buộc topology hỗ trợ transaction bằng `MONGODB_REQUIRE_TRANSACTIONS=true`.
- Attempt quá hạn được cập nhật trước khi tính system stats.
- Unique user metric được tách thành một document `(date, user_id)`, không còn tăng vô hạn một array trong document theo ngày.

Production phải dùng MongoDB Atlas/replica set vì safe delete Course/Lesson dùng transaction.

## 6. Frontend

- Auto-submit được lên lịch trước deadline 5 giây, đọc đáp án mới nhất từ ref và chặn submit trùng.
- Nếu auto-submit lỗi, giao diện giữ đáp án và hiện nút thử lại rõ ràng.
- API có timeout mặc định 30 giây; AI/OCR có timeout dài riêng.
- Upload S3 single/multipart có timeout và thông báo lỗi mạng.
- Route không tồn tại hiển thị trang 404.
- Internal anchor được điều hướng bằng History API; back/forward hoạt động và route query mới được remount.
- Các page dùng `React.lazy`, giảm initial JavaScript bundle và loại bỏ cảnh báo chunk chính trên 500 KB.

## 7. CI/CD và AWS

- GitHub Actions có `concurrency`, không để hai production deploy chạy đè nhau.
- Backend chạy test trước khi build/push.
- EC2 pull và chạy đúng image tag `${GITHUB_SHA}`, không dùng `latest`.
- Image mới được smoke-test trước trên `127.0.0.1:5001` khi container cũ vẫn chạy. Sau khi chuyển port production, container cũ được giữ với tên rollback; bản mới phải pass `/health/ready`, nếu không workflow khôi phục bản cũ.
- Frontend chỉ deploy sau backend.
- Workflow chỉ chấp nhận `VITE_API_BASE_URL=/api` hoặc URL HTTPS.
- Assets có hash được upload trước, không xóa asset bản cũ trước khi chuyển `index.html`.
- AWS credential dài hạn được thay bằng GitHub OIDC role.
- SSH deploy kiểm tra host fingerprint.
- Hướng dẫn AWS chuyển frontend bucket sang private + CloudFront OAC.
- Cùng CloudFront distribution dùng behavior `/api/*` chuyển vào EC2, tránh mixed content.

## 8. Kiểm tra

Các lệnh kiểm tra bắt buộc:

```bash
cd LearnSphere_BE
npm test

cd ../LearnSphere_FE
npm run build
```

Đã kiểm tra:

- Backend JavaScript syntax/import: đạt.
- Backend smoke tests cho live/readiness/404/CORS/security headers: đạt.
- Frontend TypeScript + Vite production build: đạt.
- `npm audit --omit=dev`: không có vulnerability tại thời điểm audit.
- `git diff --check`: đạt.

Chưa kiểm tra tích hợp với tài nguyên AWS thật trong lượt sửa này. Trước production cần chạy staging smoke test cho MongoDB transaction, cookie qua CloudFront, Bedrock/Groq, presigned upload, multipart complete và S3 cleanup retry.
