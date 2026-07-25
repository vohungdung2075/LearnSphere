# Multipart upload và orphan cleanup — 2026-07-24

## Hành vi mới

- Video từ 25 MB dùng S3 multipart upload.
- Mỗi part mặc định 10 MB, tối đa 3 part tải song song.
- Mỗi part được retry tối đa 3 lần; không phải tải lại toàn bộ video khi một part lỗi.
- File nhỏ vẫn dùng presigned `PutObject`, sau đó frontend gọi confirm.
- Mỗi upload có một `UploadSession` trong MongoDB.
- Khi key được lưu thành công vào Course/Lesson/User, session được xóa vì file đã attached.
- Session chưa attached sau 24 giờ được scheduler xử lý.
- Trước khi xóa, scheduler kiểm tra lại reference trong Course, Lesson và User.
- Multipart chưa hoàn tất được abort; object đã upload nhưng không dùng được xóa.
- Cleanup lỗi được retry với exponential backoff.

## Environment

```env
S3_MULTIPART_PART_SIZE_MB=10
S3_MULTIPART_URL_EXPIRES_IN=3600
UPLOAD_SESSION_TTL_HOURS=24
UPLOAD_CLEANUP_INTERVAL_MINUTES=15
UPLOAD_CLEANUP_BATCH_SIZE=20
```

## AWS bắt buộc

IAM principal của backend cần thêm:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject",
    "s3:AbortMultipartUpload"
  ],
  "Resource": "arn:aws:s3:::learnsphere-media-<UNIQUE_SUFFIX>/courses/*"
}
```

Bucket CORS phải expose `ETag`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://YOUR_CLOUDFRONT_DOMAIN"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Nên bổ sung S3 Lifecycle rule `AbortIncompleteMultipartUpload` sau 1 ngày làm lớp bảo vệ nếu backend ngừng hoạt động dài ngày.
