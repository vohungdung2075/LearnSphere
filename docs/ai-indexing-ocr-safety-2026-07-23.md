# AI indexing và OCR safety — 2026-07-23

## Lỗi trước đây

### Trạng thái `processing` bị kẹt

Backend chỉ lưu `ai_index_status = processing` mà không lưu thời điểm bắt đầu hoặc mã định danh lượt chạy. Nếu process Node.js restart, EC2 hết RAM hoặc container bị thay trong lúc OCR, trạng thái không bao giờ được hoàn tất. Mọi lần gọi sau đều nhận `AI_INDEX_IN_PROGRESS`.

Hai request gần nhau cũng có thể cùng đọc trạng thái cũ trước khi một request kịp lưu `processing`.

### OCR dùng quá nhiều tài nguyên

Backend render tối đa 20 trang PDF ở độ rộng 1800 px vào một mảng rồi mới OCR. Với PDF scan, nhiều buffer ảnh có thể cùng nằm trong RAM. Trên EC2 `t3.micro` 1 GB, đây là nguy cơ OOM đáng kể.

Endpoint `/api/lessons/:lesson_id/ai-index` cũng chưa dùng AI rate limit và không có timeout OCR riêng.

## Thay đổi đã áp dụng

- Thêm `ai_index_started_at` và `ai_index_run_id`.
- Claim lượt indexing bằng một `findOneAndUpdate` nguyên tử. Chỉ một request được phép xử lý một lesson tại một thời điểm.
- Kết quả OCR chỉ được lưu nếu `document_key` và `run_id` vẫn khớp. Kết quả cũ không thể ghi đè document vừa thay.
- Lượt `processing` quá `AI_INDEX_STALE_MS` được xem là gián đoạn và có thể chạy lại.
- Khi đọc lesson/danh sách lesson, trạng thái stale được chuyển thành `failed` kèm thông báo có thể retry.
- PDF scan được render và OCR lần lượt từng trang; buffer trang trước có thể được giải phóng trước khi sang trang tiếp theo.
- Giảm mặc định xuống 12 trang, độ rộng 1400 px.
- OCR có timeout tổng mặc định 120 giây.
- Mặc định chỉ cho một OCR cục bộ chạy đồng thời trên mỗi backend instance.
- Endpoint indexing dùng chung rate limit AI theo user.
- Frontend cho phép bấm lại khi hiển thị `processing`; backend sẽ từ chối nếu job thật sự vẫn chạy và cho retry nếu job đã stale.

## Cấu hình

```env
AI_INDEX_MAX_CHARS=200000
AI_INDEX_STALE_MS=600000
AI_PDF_OCR_MAX_PAGES=12
AI_PDF_OCR_IMAGE_WIDTH=1400
AI_PDF_OCR_TIMEOUT_MS=120000
AI_PDF_OCR_MAX_CONCURRENT=1
AI_PDF_OCR_MIN_TEXT_CHARS=200
```

Với EC2 `t3.micro`, không nên tăng `AI_PDF_OCR_MAX_CONCURRENT` quá `1`. Nếu thường xuyên OCR tài liệu dài, nên chuyển OCR sang worker riêng hoặc dịch vụ OCR managed thay vì tăng giới hạn trên web server.
