# Logic safety changes — 2026-07-23

Tài liệu này ghi lại ba nhóm thay đổi được thực hiện trước khi tiếp tục deploy.

## 1. Quiz auto-submit

### Trước thay đổi

- Timer giữ một snapshot cũ của `selectedAnswers`.
- Khi hết giờ, bài có thể được nộp với danh sách đáp án rỗng dù học viên đã chọn đáp án.
- Request chỉ bắt đầu khi đồng hồ đã về `0`, nên độ trễ mạng có thể khiến backend từ chối vì quá hạn.

### Sau thay đổi

- Đáp án mới nhất được đồng bộ vào `selectedAnswersRef`.
- Cả nút nộp thủ công và auto-submit đều đọc cùng snapshot mới nhất này.
- Auto-submit chỉ được kích hoạt một lần và bắt đầu trong giây cuối để request có thời gian đến backend trước `expires_at`.
- Ref và cờ auto-submit được reset khi đổi quiz hoặc làm lại.

## 2. Xóa dữ liệu và dọn S3 an toàn

### Trước thay đổi

- Xóa Lesson/Course thực hiện xóa S3 trước rồi mới xóa nhiều collection MongoDB.
- Nếu MongoDB lỗi sau khi S3 đã xóa, dữ liệu còn lại có thể tham chiếu tới file không còn tồn tại.
- Xóa Course bằng nhiều lệnh song song nhưng không có transaction, nên có thể chỉ xóa được một phần.

### Sau thay đổi

- Xóa Lesson và xóa vĩnh viễn Course chạy các thay đổi MongoDB trong transaction.
- Trong cùng transaction, hệ thống tạo một `S3CleanupTask` bền vững.
- Chỉ sau khi transaction commit, hệ thống mới thử xóa file/prefix S3.
- Nếu S3 lỗi, thao tác xóa dữ liệu chính vẫn hoàn tất và task chuyển sang `failed` để retry theo exponential backoff.
- Scheduler xử lý task pending/failed kể cả khi tính năng tự động xóa khóa học hết hạn đang tắt.
- Task bị kẹt ở `processing` quá 15 phút được phép claim lại.
- Response xóa có thêm `s3_cleanup_pending` để frontend biết file đã xóa ngay hay đang chờ retry.

### Cấu hình mới

```env
S3_CLEANUP_INTERVAL_MINUTES=5
```

MongoDB production phải hỗ trợ transaction. MongoDB Atlas đáp ứng yêu cầu này; MongoDB local cần chạy dưới dạng replica set.

## 3. Notification không làm hỏng thao tác chính

### Trước thay đổi

- Enrollment/account/discussion được lưu trước rồi mới tạo notification.
- Nếu notification lỗi, API trả `500` dù thay đổi nghiệp vụ đã thành công.
- Người dùng thử lại có thể gặp lỗi trùng hoặc trạng thái khó hiểu.

### Sau thay đổi

- Thêm `createNotificationBestEffort`.
- Lỗi tạo notification được ghi log kèm context nhưng không làm API chính thất bại.
- Đã áp dụng cho:
  - đăng ký khóa học mở hoặc chờ duyệt;
  - duyệt/từ chối đăng ký;
  - kích hoạt/khóa tài khoản;
  - tạo thảo luận và phản hồi.

### Giới hạn còn lại

Best-effort ngăn API báo sai trạng thái nhưng chưa đảm bảo notification chắc chắn được gửi lại. Nếu cần đảm bảo giao nhận, bước tiếp theo là bổ sung notification outbox và worker retry tương tự `S3CleanupTask`.
