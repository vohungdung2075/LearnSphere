# BÁO CÁO TRIỂN KHAI HỆ THỐNG LEARNSPHERE LÊN AWS

## 1. Thông tin chung

- **Tên hệ thống:** LearnSphere – Nền tảng học tập trực tuyến tích hợp AI.
- **Phạm vi công việc:** Triển khai mã nguồn từ môi trường local lên môi trường production trên AWS.
- **Khu vực AWS:** Singapore – `ap-southeast-1`.
- **Repository:** `https://github.com/vohungdung2075/LearnSphere`.
- **Địa chỉ production:** `https://d2onzy56n3iw1w.cloudfront.net`.
- **Ngày hoàn thành triển khai:** 24/07/2026.

### Mục tiêu triển khai

Quá trình triển khai hướng tới các mục tiêu sau:

1. Đóng gói Backend Node.js thành Docker image và chạy ổn định trên Amazon EC2.
2. Build Frontend React/Vite thành static files, lưu trên Amazon S3 và phân phối qua Amazon CloudFront.
3. Lưu video, tài liệu, thumbnail và avatar trên một S3 bucket riêng tư.
4. Tiếp tục sử dụng MongoDB Atlas làm cơ sở dữ liệu vì hệ thống đang sử dụng Mongoose.
5. Xây dựng quy trình CI/CD tự động bằng GitHub Actions.
6. Không lưu AWS Access Key dài hạn trong source code, GitHub hoặc máy chủ.
7. Có health check và cơ chế rollback nếu container mới không thể khởi động.

> **[CHÈN HÌNH 1 TẠI ĐÂY – Mã nguồn chạy thành công ở local]**
>
> Nội dung nên chụp: cửa sổ terminal chạy Backend và Frontend ở local, hoặc kết quả `npm test` và `npm run build`.
>
> **Chú thích đề xuất:** *Hình 1. Kiểm tra mã nguồn LearnSphere trước khi triển khai.*

---

## 2. Kiến trúc triển khai

Hệ thống được triển khai theo kiến trúc sau:

```text
Người dùng
    |
    | HTTPS
    v
Amazon CloudFront
    |---------------- Default behavior ----------------> S3 Frontend
    |
    |---------------- /api/* --------------------------> EC2:5000
                                                               |
                                                               | MongoDB connection
                                                               +------> MongoDB Atlas
                                                               |
                                                               | AWS SDK + IAM Role
                                                               +------> S3 Media
                                                               +------> Amazon Bedrock
                                                               +------> CloudWatch Logs

GitHub Actions
    |
    | OIDC temporary credentials
    v
IAM Deploy Role
    |------> ECR: push Docker image
    |------> SSM: yêu cầu EC2 triển khai image
    |------> S3: upload Frontend
    +------> CloudFront: tạo invalidation
```

Các thành phần chính:

| Thành phần | Dịch vụ sử dụng | Vai trò |
|---|---|---|
| Frontend | React/Vite, S3, CloudFront | Giao diện web và phân phối nội dung qua HTTPS |
| Backend | Node.js, Express, Docker, EC2 | Cung cấp REST API |
| Docker Registry | Amazon ECR | Lưu các phiên bản Docker image của Backend |
| Media Storage | Amazon S3 | Lưu video, document, thumbnail và avatar |
| Database | MongoDB Atlas | Lưu dữ liệu người dùng, khóa học, quiz và tiến độ |
| CI/CD | GitHub Actions | Kiểm thử, build và deploy tự động |
| Server management | AWS Systems Manager | Điều khiển EC2 mà không cần SSH |
| Monitoring | Amazon CloudWatch | Lưu log container và theo dõi EC2 |
| AI | Amazon Bedrock/Groq | Chat, tóm tắt tài liệu và sinh câu hỏi |

> **[CHÈN HÌNH 2 TẠI ĐÂY – Sơ đồ kiến trúc AWS]**
>
> Có thể vẽ lại sơ đồ trên bằng draw.io, Canva hoặc PowerPoint.
>
> **Chú thích đề xuất:** *Hình 2. Kiến trúc triển khai LearnSphere trên AWS.*

---

### Trình tự thực tế đã thực hiện

Các phần tiếp theo được trình bày đúng theo thứ tự thao tác trong quá trình triển khai:

| Bước | Công việc |
|---:|---|
| 1 | Kiểm tra code local, test Backend, build Frontend và chuẩn bị Dockerfile |
| 2 | Tạo GitHub OIDC Provider, IAM Deploy Role và IAM Role cho EC2 |
| 3 | Tạo hai S3 bucket cho media và Frontend |
| 4 | Tạo ECR repository `learnsphere-be` |
| 5 | Khởi tạo EC2, cài Docker, AWS CLI và cấu hình swap |
| 6 | Giữ MongoDB Atlas và cấu hình kết nối từ EC2 |
| 7A | Tạo CloudFront distribution cho S3 Frontend, OAC và bucket policy |
| 7B | Thêm EC2 origin, behavior `/api/*`, SPA Function và lấy CloudFront domain |
| 8 | Tạo `.env` trên EC2, kiểm tra IAM Role và quyền truy cập S3 |
| 9 | Cấu hình GitHub Secrets, CI/CD, push code, sửa lỗi OIDC và chạy lại |
| 10 | Kiểm tra container, database, log và giao diện production |

---

## BƯỚC 1 — Chuẩn bị mã nguồn tại local

### 1.1. Kiểm tra cấu trúc dự án

Workspace gồm hai phần:

```text
LearnSphere/
├── LearnSphere_BE/       # Backend Node.js/Express
├── LearnSphere_FE/       # Frontend React/Vite
├── .github/workflows/    # GitHub Actions
└── docs/                 # Tài liệu dự án
```

Trước khi triển khai, chạy kiểm thử Backend:

```powershell
cd LearnSphere_BE
npm ci
npm test
```

Tiếp theo, kiểm tra Frontend có thể build production:

```powershell
cd ..\LearnSphere_FE
npm ci
npm run build
```

Kết quả yêu cầu:

- Backend test không có test case thất bại.
- TypeScript không báo lỗi.
- Vite tạo thư mục `LearnSphere_FE/dist`.

### 1.2. Chuẩn bị Dockerfile cho Backend

Backend sử dụng multi-stage Dockerfile với Node.js 24 Alpine:

1. Stage `deps` cài production dependencies bằng `npm ci`.
2. Stage `runner` chỉ sao chép source code và dependencies cần thiết.
3. Tạo user `nodejs` có UID `1001`, không chạy ứng dụng bằng root.
4. Expose port `5000`.
5. Cấu hình Docker health check gọi `/health/ready`.

Lệnh kiểm tra Docker image ở local:

```powershell
cd LearnSphere_BE
docker build -t learnsphere-be:local .
docker run --rm -p 5000:5000 --env-file .env learnsphere-be:local
```

File `.dockerignore` loại bỏ `.env`, `.git`, `node_modules` và log để không đưa dữ liệu nhạy cảm hoặc file không cần thiết vào image.

> **[CHÈN HÌNH 3 TẠI ĐÂY – Docker build thành công]**
>
> Nội dung nên chụp: phần cuối kết quả `docker build`, không chụp nội dung `.env`.
>
> **Chú thích đề xuất:** *Hình 3. Đóng gói Backend LearnSphere thành Docker image.*

---

## BƯỚC 2 — Thiết lập IAM

### 2.1. Tạo OIDC Provider cho GitHub Actions

Trong AWS Console:

1. Mở **IAM → Identity providers**.
2. Chọn **Add provider**.
3. Chọn loại **OpenID Connect**.
4. Nhập:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
5. Hoàn thành tạo provider.

OIDC cho phép GitHub Actions nhận credentials tạm thời từ AWS. Vì vậy hệ thống không cần lưu `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` dài hạn trong GitHub Secrets.

> **[CHÈN HÌNH 4 TẠI ĐÂY – GitHub OIDC Provider]**
>
> Nội dung nên chụp: trang chi tiết provider `token.actions.githubusercontent.com`.
>
> **Chú thích đề xuất:** *Hình 4. Cấu hình GitHub OIDC Provider trong AWS IAM.*

### 2.2. Tạo IAM Role cho GitHub Actions

Tạo role có tên:

```text
LearnSphereGitHubDeployRole
```

Trust policy chỉ cho phép repository LearnSphere trên nhánh `main` gọi:

```text
sts:AssumeRoleWithWebIdentity
```

Role deploy được cấp các quyền tối thiểu:

- Push image vào ECR repository `learnsphere-be`.
- Upload Frontend vào bucket `learnsphere-fe-575620421319`.
- Tạo CloudFront invalidation cho distribution của LearnSphere.
- Gửi lệnh `AWS-RunShellScript` tới đúng EC2 instance qua Systems Manager.
- Đọc trạng thái và kết quả lệnh SSM.

Phạm vi trust policy phải giới hạn đúng repository và branch, không cho phép mọi repository GitHub assume role.

> **[CHÈN HÌNH 5 TẠI ĐÂY – Trust relationship của GitHub Deploy Role]**
>
> Nội dung nên chụp: tab **Trust relationships**. Có thể để ARN nhưng cần che thông tin không muốn công khai.
>
> **Chú thích đề xuất:** *Hình 5. Trust policy giới hạn GitHub repository được phép assume role.*

> **[CHÈN HÌNH 6 TẠI ĐÂY – Permission policy của GitHub Deploy Role]**
>
> Nội dung nên chụp: danh sách policy hoặc phần Summary thể hiện ECR, S3, CloudFront và SSM.
>
> **Chú thích đề xuất:** *Hình 6. Các quyền triển khai được gắn cho GitHub Actions.*

### 2.3. Tạo IAM Role cho EC2

Tạo role:

```text
LearnSphereEc2Role
```

Trusted entity của role là dịch vụ EC2. Role được gắn vào EC2 instance để Backend và các lệnh AWS CLI trên máy chủ tự lấy credentials tạm thời.

Các nhóm quyền:

- `AmazonSSMManagedInstanceCore`: kết nối và chạy lệnh qua Session Manager/SSM.
- `AmazonEC2ContainerRegistryReadOnly`: pull Docker image từ ECR.
- S3 media: `ListBucket`, `PutObject`, `GetObject`, `DeleteObject`, `AbortMultipartUpload`.
- CloudWatch Logs: tạo log stream và ghi log vào `/learnsphere/backend`.
- Bedrock: `InvokeModel` và `InvokeModelWithResponseStream`.

Backend không khai báo Access Key trong `/home/ec2-user/.env`. AWS SDK tự lấy temporary credentials từ EC2 Instance Metadata Service.

> **[CHÈN HÌNH 7 TẠI ĐÂY – IAM Role gắn với EC2]**
>
> Nội dung nên chụp: trang EC2 instance hoặc IAM role thể hiện `LearnSphereEc2Role`.
>
> **Chú thích đề xuất:** *Hình 7. IAM Role cung cấp quyền AWS cho Backend trên EC2.*

---

## BƯỚC 3 — Tạo và cấu hình Amazon S3

Hệ thống sử dụng hai bucket riêng biệt để tách mã Frontend và dữ liệu người dùng.

### 3.1. Bucket lưu media

Thông tin bucket:

```text
learnsphere-media-575620421319
```

Bucket này lưu:

- Video bài học.
- PDF/DOCX.
- Thumbnail khóa học.
- Avatar người dùng.

Các thiết lập:

1. Region `ap-southeast-1`.
2. Bật **Block all public access**.
3. Không bật Static Website Hosting.
4. Chỉ truy cập thông qua Backend và presigned URL có thời hạn.
5. Cấu hình CORS cho phép `GET`, `PUT`, header cần thiết và expose `ETag`.

Ví dụ CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://d2onzy56n3iw1w.cloudfront.net"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ETag` được expose để Frontend hoàn tất multipart upload đối với video dung lượng lớn.

> **[CHÈN HÌNH 8 TẠI ĐÂY – Hai S3 bucket]**
>
> Nội dung nên chụp: danh sách bucket, thể hiện bucket media và bucket frontend.
>
> **Chú thích đề xuất:** *Hình 8. Hai S3 bucket phục vụ media và static frontend.*

> **[CHÈN HÌNH 9 TẠI ĐÂY – CORS của bucket media]**
>
> Nội dung nên chụp: phần CORS configuration, không có secret.
>
> **Chú thích đề xuất:** *Hình 9. Cấu hình CORS để trình duyệt upload/download media bằng presigned URL.*

### 3.2. Bucket chứa Frontend

Thông tin bucket:

```text
learnsphere-fe-575620421319
```

Ở bước này chỉ tạo bucket, giữ **Block all public access** ở trạng thái bật và không bật S3 Static Website Hosting. Bucket policy cho CloudFront chưa thể hoàn thiện vì chưa có Distribution ID; policy được cập nhật sau tại Bước 7A.3.

> **[CHÈN HÌNH 10 TẠI ĐÂY – Cấu hình bucket Frontend]**
>
> Nội dung nên chụp: bucket `learnsphere-fe-575620421319` với Block all public access đang bật.
>
> **Chú thích đề xuất:** *Hình 10. S3 bucket riêng tư dùng để lưu bản build Frontend.*

---

## BƯỚC 4 — Tạo Amazon ECR Repository

Thao tác:

1. Mở **Amazon ECR → Private repositories**.
2. Chọn **Create repository**.
3. Đặt tên:

```text
learnsphere-be
```

4. Bật scan image khi push.
5. Tạo lifecycle policy để chỉ giữ một số image gần nhất.

Mỗi Docker image được tag bằng SHA của Git commit:

```text
575620421319.dkr.ecr.ap-southeast-1.amazonaws.com/learnsphere-be:<GIT_SHA>
```

Tag theo commit giúp xác định chính xác phiên bản đang chạy và hỗ trợ rollback.

> **[CHÈN HÌNH 11 TẠI ĐÂY – ECR Repository]**
>
> Nội dung nên chụp: repository `learnsphere-be` và danh sách image tag SHA.
>
> **Chú thích đề xuất:** *Hình 11. Docker images của Backend được lưu trên Amazon ECR.*

---

## BƯỚC 5 — Khởi tạo và cấu hình EC2

### 5.1. Tạo EC2 instance

Cấu hình đã sử dụng:

| Thuộc tính | Giá trị |
|---|---|
| AMI | Amazon Linux 2023 |
| Instance type | `t3.small` |
| RAM | 2 GB |
| Region | `ap-southeast-1` |
| IAM Instance Profile | `LearnSphereEc2Role` |
| Backend port | `5000` |
| Instance ID | `i-008c48e6c120b2978` |

Security Group chỉ cho phép CloudFront origin-facing network truy cập port `5000`. Quản trị máy chủ được thực hiện qua Systems Manager thay vì mở SSH công khai.

> **[CHÈN HÌNH 12 TẠI ĐÂY – EC2 instance Summary]**
>
> Nội dung nên chụp: instance state, instance type, region, IAM role và Instance ID. Có thể che Public IP nếu cần.
>
> **Chú thích đề xuất:** *Hình 12. EC2 instance chạy Backend LearnSphere.*

### 5.2. Cài Docker và kiểm tra AWS CLI

Mở **EC2 → Connect → Session Manager**, sau đó chạy:

```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
```

Kiểm tra:

```bash
docker --version
sudo systemctl status docker --no-pager
aws --version
```

Kết quả thực tế:

```text
Docker version 25.x
docker.service: active (running)
AWS CLI 2.x
```

Do hệ thống có xử lý OCR tài liệu PDF, EC2 được bổ sung 2 GB swap để giảm nguy cơ hết RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
free -h
```

Kết quả `free -h` hiển thị khoảng 1.9 GB RAM và 2.0 GB swap.

> **[CHÈN HÌNH 13 TẠI ĐÂY – Docker, AWS CLI và RAM/Swap]**
>
> Nội dung nên chụp: kết quả `docker --version`, `systemctl status docker`, `aws --version` và `free -h`.
>
> **Chú thích đề xuất:** *Hình 13. Môi trường Docker và tài nguyên hệ thống trên EC2.*

### 5.3. Xác nhận IAM Instance Profile và Systems Manager

Sau khi instance khởi động, kiểm tra trong EC2 Console:

- IAM Role đã gắn là `LearnSphereEc2Role`.
- Instance xuất hiện trong Systems Manager.
- Có thể mở **Session Manager → Connect** mà không cần SSH key.

Việc kiểm tra quyền thực tế bằng AWS CLI được thực hiện sau khi hoàn thành file môi trường ở Bước 8.4.

## BƯỚC 6 — Kết nối MongoDB Atlas

LearnSphere tiếp tục sử dụng MongoDB Atlas thay vì chuyển sang RDS/DynamoDB vì:

- Backend đã sử dụng Mongoose ODM.
- Dữ liệu có cấu trúc document phù hợp với MongoDB.
- Việc đổi hệ quản trị cơ sở dữ liệu sẽ làm tăng đáng kể phạm vi chỉnh sửa.

Các thao tác:

1. Tạo database user riêng cho ứng dụng.
2. Đặt mật khẩu mạnh và không commit vào Git.
3. Cho phép địa chỉ mạng của EC2 truy cập Atlas.
4. Chọn database cho môi trường production.
5. Đặt connection string vào `MONGODB_URI` trên EC2.
6. Health check `/health/ready` chỉ trả trạng thái ready khi MongoDB đã kết nối.

> **[CHÈN HÌNH 14 TẠI ĐÂY – MongoDB Atlas Cluster]**
>
> Nội dung nên chụp: cluster đang hoạt động và database/deployment name. Không chụp password hoặc connection string.
>
> **Chú thích đề xuất:** *Hình 14. MongoDB Atlas được sử dụng làm cơ sở dữ liệu production.*

---

## BƯỚC 7 — Cấu hình Amazon CloudFront

CloudFront distribution:

```text
Distribution ID: EQRDOBSCG5MC8
Domain: d2onzy56n3iw1w.cloudfront.net
```

Quá trình này được thực hiện thành hai phần đúng theo thứ tự thực tế: **7A cấu hình Frontend S3** và **7B kết nối Backend API**.

### 7A. Cấu hình Frontend S3 và Origin Access Control

#### 7A.1. Tạo distribution và chọn S3 origin

Origin mặc định là bucket:

```text
learnsphere-fe-575620421319
```

#### 7A.2. Cấu hình default behavior và OAC

Thiết lập:

- S3 origin dùng Origin Access Control.
- Default root object: `index.html`.
- Redirect HTTP sang HTTPS.
- Cache lâu cho asset có hash.
- `index.html` không cache để nhận phiên bản mới.

#### 7A.3. Cập nhật S3 bucket policy

Sau khi distribution được tạo, cập nhật bucket policy của `learnsphere-fe-575620421319`. Policy cho phép CloudFront service principal đọc object và giới hạn bằng Source ARN của đúng distribution:

```json
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::learnsphere-fe-575620421319/*",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": "arn:aws:cloudfront::575620421319:distribution/EQRDOBSCG5MC8"
        }
      }
    }
  ]
}
```

Không sử dụng `Principal: "*"` và không tắt **Block all public access**.

> **[CHÈN HÌNH 15 TẠI ĐÂY – Bucket policy của Frontend]**
>
> Nội dung nên chụp: policy cho phép CloudFront service principal đọc object.
>
> **Chú thích đề xuất:** *Hình 15. Bucket policy được cập nhật sau khi tạo CloudFront OAC.*

### 7B. Kết nối CloudFront với Backend EC2

#### 7B.1. Thêm Backend origin

Thêm origin trỏ tới Public DNS/địa chỉ ổn định của EC2:

```text
Origin protocol: HTTP only
HTTP port: 5000
```

Security Group của EC2 chỉ cho CloudFront origin-facing network truy cập port này.

> **[CHÈN HÌNH 16A TẠI ĐÂY – CloudFront Origins]**
>
> Nội dung nên chụp: hai origin S3 và EC2/backend.
>
> **Chú thích đề xuất:** *Hình 16A. Hai origin Frontend và Backend của CloudFront distribution.*

#### 7B.2. Tạo behavior `/api/*`

Tạo behavior:

```text
Path pattern: /api/*
Origin: EC2 Backend
Cache policy: CachingDisabled
Origin request policy: AllViewerExceptHostHeader
```

Cho phép các method:

```text
GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
```

Frontend sử dụng:

```text
VITE_API_BASE_URL=/api
```

Do đó Browser chỉ gọi HTTPS đến cùng CloudFront domain. CloudFront chuyển `/api/*` tới EC2 qua port `5000`, tránh lỗi mixed content.

> **[CHÈN HÌNH 16B TẠI ĐÂY – CloudFront Behaviors]**
>
> Nội dung nên chụp: default behavior và behavior `/api/*`.
>
> **Chú thích đề xuất:** *Hình 16B. CloudFront định tuyến Frontend và Backend API.*

#### 7B.3. Thêm CloudFront Function cho SPA routing

React sử dụng client-side routing. Khi người dùng truy cập trực tiếp `/profile`, `/courses` hoặc một route không chứa phần mở rộng file, CloudFront Function đổi URI thành `/index.html`.

```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith("/") || !uri.split("/").pop().includes(".")) {
    request.uri = "/index.html";
  }

  return request;
}
```

Function chỉ gắn vào default behavior S3, không gắn vào `/api/*`; nhờ đó lỗi API vẫn giữ đúng status code và JSON response.

> **[CHÈN HÌNH 17 TẠI ĐÂY – CloudFront Function association]**
>
> Nội dung nên chụp: source code function hoặc association ở sự kiện Viewer request.
>
> **Chú thích đề xuất:** *Hình 17. CloudFront Function hỗ trợ điều hướng SPA.*

#### 7B.4. Ghi lại domain và kiểm tra distribution

Sau khi distribution chuyển sang trạng thái **Deployed**, ghi lại:

```text
Distribution ID: EQRDOBSCG5MC8
Domain: d2onzy56n3iw1w.cloudfront.net
```

Domain này được dùng cho `FRONTEND_URL`, CORS của S3 media và kiểm tra giao diện sau deploy.

---

## BƯỚC 8 — Cấu hình môi trường Backend trên EC2

### 8.1. Tạo file `.env`

Sau khi CloudFront domain đã có, quay lại EC2 bằng Session Manager. File cấu hình production được đặt tại:

```text
/home/ec2-user/.env
```

Tạo file và giới hạn quyền đọc:

```bash
sudo touch /home/ec2-user/.env
sudo chmod 600 /home/ec2-user/.env
sudo vi /home/ec2-user/.env
```

### 8.2. Điền các nhóm biến production

```dotenv
PORT=5000
NODE_ENV=production
TRUST_PROXY=true

MONGODB_URI=<MONGODB_ATLAS_CONNECTION_STRING>
MONGODB_REQUIRE_TRANSACTIONS=true

JWT_SECRET=<RANDOM_SECRET_AT_LEAST_64_CHARACTERS>
FRONTEND_URL=https://d2onzy56n3iw1w.cloudfront.net

AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=learnsphere-media-575620421319

AI_PROVIDER=<bedrock_or_groq>
BEDROCK_REGION=ap-southeast-1
BEDROCK_MODEL_ID=<MODEL_OR_INFERENCE_PROFILE_ID>
GROQ_API_KEY=<OPTIONAL_SECRET>
```

Không đặt `AWS_ACCESS_KEY_ID` hoặc `AWS_SECRET_ACCESS_KEY` vì Backend sử dụng `LearnSphereEc2Role`.

### 8.3. Kiểm tra biến mà không làm lộ giá trị

```bash
sudo awk -F= '
  /^[A-Z0-9_]+=/ {
    if (length($2) > 0) print "OK: " $1;
    else print "THIEU: " $1
  }
' /home/ec2-user/.env
```

> **[CHÈN HÌNH 18 TẠI ĐÂY – Kiểm tra tên biến môi trường]**
>
> Chỉ chụp các dòng `OK: TÊN_BIẾN`. Tuyệt đối không chụp MongoDB URI, JWT secret, email password hoặc AI API key.
>
> **Chú thích đề xuất:** *Hình 18. Kiểm tra các biến môi trường production trên EC2.*

### 8.4. Xác minh IAM Role và S3 từ EC2

Chạy lại:

```bash
aws sts get-caller-identity
aws s3api head-bucket --bucket learnsphere-media-575620421319
```

Kết quả phải cho thấy assumed role `LearnSphereEc2Role` và truy cập được media bucket.

ARN kết quả có dạng:

```text
arn:aws:sts::575620421319:assumed-role/LearnSphereEc2Role/...
```

Điều này chứng minh EC2 đang sử dụng temporary credentials từ IAM Role, không dùng Access Key hardcode.

> **[CHÈN HÌNH 19 TẠI ĐÂY – Kết quả get-caller-identity]**
>
> Nội dung nên chụp: ARN của assumed role và kết quả kiểm tra bucket. Không chụp Access Key.
>
> **Chú thích đề xuất:** *Hình 19. EC2 nhận temporary credentials từ IAM Role.*

---

## BƯỚC 9 — Cấu hình GitHub và thực hiện CI/CD

### 9.1. Cấu hình GitHub Actions Secrets

Mở:

```text
GitHub Repository
→ Settings
→ Secrets and variables
→ Actions
→ Repository secrets
```

Tạo năm secret:

| Secret | Nội dung |
|---|---|
| `AWS_GITHUB_ROLE_ARN` | ARN của `LearnSphereGitHubDeployRole` |
| `EC2_INSTANCE_ID` | `i-008c48e6c120b2978` |
| `VITE_API_BASE_URL` | `/api` |
| `S3_FE_BUCKET` | `learnsphere-fe-575620421319` |
| `CLOUDFRONT_FE_DISTRIBUTION_ID` | `EQRDOBSCG5MC8` |

Các định danh như bucket name, instance ID và distribution ID không phải mật khẩu, tuy nhiên vẫn được quản lý tập trung bằng GitHub Secrets để workflow không hardcode theo môi trường.

Không sử dụng các secret deploy cũ:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
EC2_HOST
EC2_SSH_KEY
ECR_REGISTRY
```

OIDC thay thế Access Key; Systems Manager thay thế SSH; ECR registry được lấy tự động từ bước login ECR.

> **[CHÈN HÌNH 20 TẠI ĐÂY – Danh sách GitHub Actions Secrets]**
>
> Chỉ chụp tên secret và thời gian cập nhật. GitHub không hiển thị lại giá trị.
>
> **Chú thích đề xuất:** *Hình 20. Các biến cấu hình được sử dụng bởi pipeline CI/CD.*

---

### 9.2. Xây dựng quy trình CI/CD

Workflow được lưu tại:

```text
.github/workflows/deploy.yml
```

Pipeline chạy trong hai trường hợp:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

Như vậy có thể chạy tự động khi push nhánh `main`, đồng thời vẫn có thể chạy thủ công từ GitHub Actions.

Workflow khai báo:

```yaml
permissions:
  contents: read
  id-token: write
```

Quyền `id-token: write` là điều kiện để GitHub nhận OIDC token và assume IAM Role.

#### 9.2.1. Job deploy Backend

Các bước của job Backend:

1. Checkout source code.
2. Cài Node.js 24.
3. Chạy `npm ci` và `npm test`.
4. Assume `LearnSphereGitHubDeployRole` qua OIDC.
5. Login Amazon ECR.
6. Build Docker image.
7. Tag image bằng `${{ github.sha }}`.
8. Push image lên ECR.
9. Gửi lệnh deploy tới EC2 bằng AWS Systems Manager.

Trên EC2, script deploy thực hiện:

1. Login ECR bằng IAM Role của EC2.
2. Pull image đúng SHA của commit.
3. Chạy container candidate trên `127.0.0.1:5001`.
4. Gọi `/health/ready` tối đa 24 lần, mỗi lần cách 5 giây.
5. Nếu candidate không ready, xóa candidate và giữ nguyên container production.
6. Nếu candidate ready, giữ container cũ với tên `learnsphere-be-rollback`.
7. Chạy container mới ở port `5000`.
8. Kiểm tra health lần cuối.
9. Nếu thất bại, tự động khôi phục container cũ.
10. Nếu thành công, xóa container rollback và dọn image không còn dùng.

Container production được chạy với:

```text
--restart unless-stopped
--env-file /home/ec2-user/.env
--log-driver awslogs
--log-opt awslogs-group=/learnsphere/backend
```

Thiết kế này giúp hạn chế downtime và tránh thay container đang hoạt động bằng một image bị lỗi.

#### 9.2.2. Job deploy Frontend

Job Frontend chỉ chạy sau khi Backend deploy thành công:

```yaml
needs: deploy-backend
```

Các bước:

1. Checkout source code.
2. Cài Node.js 24.
3. Chạy `npm ci`.
4. Kiểm tra `VITE_API_BASE_URL` là `/api` hoặc HTTPS.
5. Chạy `npm run build`.
6. Assume IAM Role qua OIDC.
7. Upload asset có hash lên S3 trước với cache một năm.
8. Upload các file root với cache ngắn.
9. Upload `index.html` cuối cùng với `no-cache`.
10. Tạo CloudFront invalidation cho `/*`.

Việc upload `index.html` cuối cùng đảm bảo file HTML chỉ tham chiếu đến asset đã tồn tại trên S3.

> **[CHÈN HÌNH 21 TẠI ĐÂY – Nội dung workflow hoặc sơ đồ CI/CD]**
>
> Có thể chụp file `deploy.yml` trong GitHub hoặc vẽ flow: Test → ECR → SSM → EC2 → S3 → CloudFront.
>
> **Chú thích đề xuất:** *Hình 21. Quy trình CI/CD tự động của LearnSphere.*

---

### 9.3. Push code từ local để kích hoạt deploy

Sau khi mã nguồn, hạ tầng và GitHub Secrets đã sẵn sàng:

```powershell
cd C:\Users\vohun\OneDrive\Documents\Desktop\AWS\LearnSphere
git status
git add .
git commit -m "feat: deploy LearnSphere to AWS"
git push origin main
```

Lệnh `git push origin main` kích hoạt workflow `Deploy LearnSphere to AWS`.

Theo dõi tại:

```text
GitHub → Actions → Deploy LearnSphere to AWS
```

Pipeline gồm:

```text
Deploy Backend (Docker → ECR → EC2)
                    |
                    v
Deploy Frontend (Build → S3 → CloudFront)
```

Frontend chỉ được phát hành khi Backend đã vượt qua test và health check.

> **[CHÈN HÌNH 22 TẠI ĐÂY – GitHub Actions chạy thành công]**
>
> Nội dung nên chụp: cả hai job có dấu check màu xanh và trạng thái Success.
>
> **Chú thích đề xuất:** *Hình 22. Pipeline triển khai Backend và Frontend hoàn tất thành công.*

### 9.4. Xử lý lỗi OIDC ở lần chạy đầu và chạy lại workflow

Ở lần chạy đầu, job Backend dừng tại bước configure AWS credentials với lỗi:

```text
Could not assume role with OIDC:
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

Trust policy của `LearnSphereGitHubDeployRole` được sửa để khớp đúng OIDC subject của repository và nhánh `main`. Sau đó chọn **Re-run jobs**. Lần chạy tiếp theo, cả job Backend và Frontend đều chuyển sang trạng thái **Success**.

---

## BƯỚC 10 — Kiểm tra sau triển khai

### 10.1. Kiểm tra container Backend

Kết nối EC2 bằng Session Manager:

```bash
sudo docker ps --filter name=learnsphere-be
```

Kết quả yêu cầu:

```text
STATUS: Up ... (healthy)
PORTS: 0.0.0.0:5000->5000/tcp
NAME: learnsphere-be
```

Kiểm tra chi tiết:

```bash
sudo docker inspect \
  --format 'status={{.State.Status}} health={{.State.Health.Status}} restarts={{.RestartCount}} image={{.Config.Image}}' \
  learnsphere-be
```

Kết quả thực tế sau deploy:

```text
status=running
health=healthy
restarts=0
```

### 10.2. Kiểm tra kết nối Database

```bash
curl -fsS http://127.0.0.1:5000/health/ready
```

Kết quả:

```json
{
  "status": "ready",
  "database": "connected"
}
```

> **[CHÈN HÌNH 23 TẠI ĐÂY – Docker container và health check]**
>
> Nội dung nên chụp: `docker ps`, `docker inspect` và kết quả `/health/ready`.
>
> **Chú thích đề xuất:** *Hình 23. Backend container hoạt động ổn định và kết nối MongoDB thành công.*

### 10.3. Kiểm tra CloudWatch Logs

Mở:

```text
CloudWatch → Log groups → /learnsphere/backend
```

Kiểm tra stream của container production, xác nhận:

- Server khởi động thành công.
- MongoDB kết nối thành công.
- Không lặp lại lỗi restart.
- API nhận request từ CloudFront.

> **[CHÈN HÌNH 24 TẠI ĐÂY – CloudWatch Log Group]**
>
> Nội dung nên chụp: log group và vài dòng log khởi động không chứa dữ liệu nhạy cảm.
>
> **Chú thích đề xuất:** *Hình 24. Log Backend được tập trung trên Amazon CloudWatch.*

### 10.4. Kiểm tra giao diện production

Truy cập:

```text
https://d2onzy56n3iw1w.cloudfront.net
```

Kiểm tra các chức năng:

1. Đăng ký/đăng nhập.
2. Frontend gọi API qua `/api`.
3. Giáo viên tạo khóa học và bài học.
4. Upload thumbnail, tài liệu và video lên S3.
5. Học viên đăng ký khóa học.
6. Học viên xem bài và làm quiz.
7. Giáo viên xem tiến độ và kết quả quiz.
8. Admin xem System Monitoring.

> **[CHÈN HÌNH 25 TẠI ĐÂY – Giao diện LearnSphere production]**
>
> Nội dung nên chụp: trang đăng nhập hoặc Dashboard trên CloudFront domain.
>
> **Chú thích đề xuất:** *Hình 25. Hệ thống LearnSphere hoạt động trên môi trường production.*

---

## BƯỚC 11 — Thiết lập cảnh báo CloudWatch và gửi email qua SNS

Sau khi hệ thống đã hoạt động trên production, Amazon CloudWatch được cấu hình để theo dõi EC2 và gửi email khi tài nguyên có dấu hiệu bất thường. Toàn bộ SNS topic, subscription và alarm trong bước này được tạo tại Region `ap-southeast-1`, cùng Region với EC2.

### 11.1. Tạo SNS topic nhận cảnh báo

Mở:

```text
Amazon SNS → Topics → Create topic
```

Thiết lập:

- **Type:** `Standard`
- **Name:** `LearnSphere-Alerts`
- Các tùy chọn còn lại giữ mặc định.

Chọn **Create topic**. Topic này là kênh trung gian nhận thông báo từ CloudWatch và chuyển tiếp đến email quản trị.

### 11.2. Đăng ký email và xác nhận subscription

Trong trang chi tiết topic `LearnSphere-Alerts`, chọn **Create subscription**:

- **Protocol:** `Email`
- **Endpoint:** email của người quản trị hệ thống.

Chọn **Create subscription**. AWS gửi một email từ **AWS Notifications** đến địa chỉ vừa khai báo. Mở email và chọn **Confirm subscription**.

Quay lại:

```text
Amazon SNS → Subscriptions
```

Subscription chỉ sẵn sàng nhận cảnh báo khi trạng thái không còn là `Pending confirmation` và cột **Subscription ARN** đã hiển thị ARN đầy đủ.

Để kiểm tra kênh email trước khi tạo alarm, mở topic `LearnSphere-Alerts`, chọn **Publish message**, nhập tiêu đề và nội dung thử nghiệm rồi chọn **Publish message**. Email nhận được thông báo thử chứng minh SNS đã hoạt động.

> **[CHÈN HÌNH 26 TẠI ĐÂY – SNS topic và email subscription đã xác nhận]**
>
> Nội dung nên chụp: topic `LearnSphere-Alerts`, protocol Email và Subscription ARN đã được xác nhận. Có thể che một phần địa chỉ email.
>
> **Chú thích đề xuất:** *Hình 26. Kênh SNS gửi cảnh báo vận hành LearnSphere qua email.*

### 11.3. Tạo alarm CPUUtilization lớn hơn 80% trong 10 phút

Mở:

```text
CloudWatch → Alarms → All alarms → Create alarm → Select metric
```

Chọn:

```text
EC2 → Per-Instance Metrics
```

Tìm theo Instance ID của EC2 LearnSphere, chọn metric `CPUUtilization`, sau đó chọn **Select metric**.

Thiết lập metric và điều kiện:

- **Statistic:** `Average`
- **Period:** `5 minutes`
- **Threshold type:** `Static`
- **Whenever CPUUtilization is:** `Greater than`
- **Threshold value:** `80`
- **Datapoints to alarm:** `2 out of 2`
- **Missing data treatment:** `Treat missing data as missing`

Hai datapoint liên tiếp, mỗi datapoint dài 5 phút, giúp alarm chỉ chuyển sang trạng thái `ALARM` khi CPU trung bình lớn hơn 80% trong khoảng 10 phút liên tục; dao động ngắn không lập tức tạo cảnh báo.

Chọn **Next**, sau đó cấu hình notification:

- **Alarm state trigger:** `In alarm`
- **Send a notification to:** `Select an existing SNS topic`
- **SNS topic:** `LearnSphere-Alerts`

Đặt tên:

```text
LearnSphere-EC2-HighCPU
```

Nhập mô tả `EC2 CPU average is above 80% for 10 minutes`, chọn **Next**, kiểm tra lại và chọn **Create alarm**.

> **[CHÈN HÌNH 27 TẠI ĐÂY – CloudWatch alarm CPU cao]**
>
> Nội dung nên chụp: tên alarm, metric `CPUUtilization`, ngưỡng `> 80` và cấu hình `2 out of 2`.
>
> **Chú thích đề xuất:** *Hình 27. CloudWatch theo dõi CPU EC2 và cảnh báo khi vượt 80% trong 10 phút.*

### 11.4. Tạo alarm StatusCheckFailed

Tiếp tục chọn **Create alarm → Select metric**, sau đó mở:

```text
EC2 → Per-Instance Metrics
```

Tìm theo cùng Instance ID và chọn metric `StatusCheckFailed`.

Thiết lập:

- **Statistic:** `Maximum`
- **Period:** `1 minute`
- **Threshold type:** `Static`
- **Whenever StatusCheckFailed is:** `Greater/Equal`
- **Threshold value:** `1`
- **Datapoints to alarm:** `1 out of 1`
- **Missing data treatment:** `Treat missing data as missing`

Metric `StatusCheckFailed` có giá trị `1` khi EC2 không vượt qua kiểm tra trạng thái instance hoặc kiểm tra trạng thái hệ thống. Với cấu hình trên, chỉ cần một lần kiểm tra thất bại là alarm chuyển sang `ALARM`.

Tại bước notification, chọn:

- **Alarm state trigger:** `In alarm`
- **SNS topic:** `LearnSphere-Alerts`

Đặt tên:

```text
LearnSphere-EC2-StatusCheckFailed
```

Nhập mô tả `EC2 instance or system status check failed`, kiểm tra lại cấu hình và chọn **Create alarm**.

> **[CHÈN HÌNH 28 TẠI ĐÂY – CloudWatch alarm StatusCheckFailed]**
>
> Nội dung nên chụp: tên alarm, metric `StatusCheckFailed`, ngưỡng `>= 1` và SNS topic nhận cảnh báo.
>
> **Chú thích đề xuất:** *Hình 28. CloudWatch phát hiện lỗi trạng thái EC2 và gửi thông báo qua SNS.*

### 11.5. Kiểm tra kết quả giám sát

Mở:

```text
CloudWatch → Alarms → All alarms
```

Xác nhận có hai alarm:

```text
LearnSphere-EC2-HighCPU
LearnSphere-EC2-StatusCheckFailed
```

Ngay sau khi tạo, alarm có thể tạm thời ở trạng thái `Insufficient data` trong lúc CloudWatch chờ datapoint đầu tiên. Khi EC2 hoạt động bình thường và đã có dữ liệu, trạng thái chuyển sang `OK`. Việc topic gửi được message thử và email subscription đã được xác nhận là bằng chứng kênh thông báo hoạt động.

Kết quả của bước này:

- CPU EC2 được theo dõi theo trung bình 10 phút.
- Sự cố kiểm tra trạng thái EC2 được phát hiện trong chu kỳ 1 phút.
- Khi alarm chuyển sang `ALARM`, CloudWatch gửi sự kiện đến `LearnSphere-Alerts` và SNS chuyển thông báo đến email quản trị.

---

## PHẦN BỔ SUNG A — Các lỗi gặp phải và cách khắc phục

### A.1. GitHub không assume được IAM Role

Thông báo:

```text
Could not assume role with OIDC:
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

Nguyên nhân là trust policy của IAM Role chưa khớp OIDC `sub` claim của repository/branch.

Cách xử lý:

1. Kiểm tra OIDC provider và audience `sts.amazonaws.com`.
2. Kiểm tra GitHub workflow có `id-token: write`.
3. Sửa trust policy để cho đúng repository LearnSphere và `refs/heads/main`.
4. Chạy lại workflow.

### A.2. GitHub Actions cảnh báo Node.js 20 deprecated

Các action phiên bản cũ sử dụng runtime Node.js 20 và GitHub đưa ra cảnh báo. Workflow được chuyển sang Node.js 24:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "24"
```

Backend Dockerfile cũng sử dụng `node:24-alpine`.

### A.3. Backend không sẵn sàng do thiếu biến môi trường

Container candidate không vượt qua health check khi `.env` thiếu `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `AWS_REGION` hoặc `AWS_S3_BUCKET`.

Cách xử lý:

1. Kiểm tra file `/home/ec2-user/.env`.
2. Không để placeholder `<...>`.
3. Đặt quyền `chmod 600`.
4. Chạy lại candidate và xem `docker logs`.

### A.4. Upload S3 bị `403 AccessDenied`

Nguyên nhân là IAM principal chỉ có quyền trên `courses/*`, chưa có quyền trên avatar hoặc prefix cần upload.

Cách xử lý:

- Gắn quyền `PutObject`, `GetObject`, `DeleteObject` đúng các prefix.
- Thêm `ListBucket` với phạm vi phù hợp.
- Thêm `AbortMultipartUpload` để dọn multipart upload dở dang.
- Cấu hình CORS đúng CloudFront origin và expose `ETag`.

### A.5. SPA route trả về 404

Nếu truy cập trực tiếp `/profile` hoặc `/courses`, S3 không có object tương ứng. CloudFront Function được thêm vào default behavior để rewrite route SPA về `/index.html`.

Không dùng custom error response toàn distribution vì có thể biến lỗi `/api/*` thành HTML status `200`.

> **[CHÈN HÌNH 29 TẠI ĐÂY – Một lỗi đã gặp và kết quả sau khắc phục]**
>
> Nên chọn lỗi OIDC hoặc trang GitHub Actions từ Failure chuyển sang Success.
>
> **Chú thích đề xuất:** *Hình 29. Khắc phục lỗi cấu hình trong quá trình triển khai.*

---

## PHẦN BỔ SUNG B — Bảo mật trong quá trình triển khai

Các biện pháp đã áp dụng:

1. Không commit `.env` lên GitHub.
2. Không lưu AWS Access Key dài hạn trong GitHub Secrets hoặc EC2.
3. GitHub Actions dùng OIDC và temporary credentials.
4. EC2 dùng IAM Instance Role.
5. Quản trị EC2 bằng Systems Manager, không phụ thuộc SSH private key.
6. S3 bucket giữ private và bật Block Public Access.
7. Frontend bucket chỉ cho CloudFront OAC truy cập.
8. Media được truy cập bằng presigned URL có thời hạn.
9. Backend Docker chạy bằng user không phải root.
10. Port Backend chỉ nhận traffic phù hợp từ CloudFront.
11. Log được gửi về CloudWatch.
12. Secret production nằm trên EC2 với quyền file `600`.

---

## PHẦN BỔ SUNG C — Quy trình cập nhật phiên bản sau này

Sau lần triển khai đầu tiên, quy trình phát hành phiên bản mới được rút gọn:

```powershell
git status
git add <các-file-đã-kiểm-tra>
git commit -m "mô tả thay đổi"
git push origin main
```

GitHub Actions tự động:

```text
Test Backend
→ Build Docker
→ Push ECR
→ Deploy EC2 bằng SSM
→ Health check/rollback
→ Build Frontend
→ Upload S3
→ Invalidate CloudFront
```

Nếu Backend không vượt qua test hoặc health check, Frontend không được deploy và container production cũ được giữ lại.

---

## KẾT QUẢ ĐẠT ĐƯỢC

Sau quá trình triển khai:

- LearnSphere hoạt động qua HTTPS trên CloudFront.
- Frontend được phân phối từ S3 private.
- Backend chạy trong Docker trên EC2.
- Backend kết nối thành công MongoDB Atlas.
- File media được lưu trên S3 và truy cập bằng presigned URL.
- Docker image được quản lý theo commit SHA trên ECR.
- Pipeline CI/CD tự động chạy khi push nhánh `main`.
- Có health check và rollback khi container mới gặp lỗi.
- Không sử dụng AWS Access Key dài hạn cho GitHub Actions hoặc EC2.
- Log Backend được lưu trên CloudWatch.

Địa chỉ sản phẩm:

```text
https://d2onzy56n3iw1w.cloudfront.net
```

> **[CHÈN HÌNH 30 TẠI ĐÂY – Kết quả cuối cùng]**
>
> Nội dung nên chụp: một trang tiêu biểu của sản phẩm với thanh địa chỉ hiển thị CloudFront domain và biểu tượng HTTPS.
>
> **Chú thích đề xuất:** *Hình 30. Sản phẩm LearnSphere sau khi triển khai hoàn chỉnh lên AWS.*

---

## PHỤ LỤC — Danh sách hình ảnh cần chuẩn bị

| Số hình | Nội dung | Mức độ |
|---:|---|---|
| 1 | Kết quả test/build local | Nên có |
| 2 | Sơ đồ kiến trúc AWS | Bắt buộc |
| 3 | Docker build | Tùy chọn |
| 4 | GitHub OIDC Provider | Nên có |
| 5 | IAM trust relationship | Bắt buộc |
| 6 | IAM deploy permissions | Nên có |
| 7 | IAM Role gắn EC2 | Bắt buộc |
| 8 | Danh sách hai S3 bucket | Bắt buộc |
| 9 | CORS bucket media | Nên có |
| 10 | Cấu hình bucket Frontend private | Nên có |
| 11 | ECR repository và images | Bắt buộc |
| 12 | EC2 instance summary | Bắt buộc |
| 13 | Docker/AWS CLI/RAM/Swap | Nên có |
| 14 | MongoDB Atlas cluster | Nên có |
| 15 | Bucket policy CloudFront OAC | Bắt buộc |
| 16A–16B | CloudFront origins và behaviors | Bắt buộc |
| 17 | CloudFront Function | Nên có |
| 18 | Kiểm tra tên biến `.env` | Tùy chọn |
| 19 | `get-caller-identity` | Tùy chọn |
| 20 | GitHub Actions Secrets | Bắt buộc |
| 21 | CI/CD flow hoặc workflow file | Nên có |
| 22 | GitHub Actions Success | Bắt buộc |
| 23 | Container healthy và DB connected | Bắt buộc |
| 24 | CloudWatch logs | Nên có |
| 25 | Giao diện production | Bắt buộc |
| 26 | SNS topic và email subscription đã xác nhận | Nên có |
| 27 | CloudWatch alarm CPU cao | Bắt buộc |
| 28 | CloudWatch alarm StatusCheckFailed | Bắt buộc |
| 29 | Lỗi và kết quả khắc phục | Tùy chọn |
| 30 | Ảnh sản phẩm cuối cùng | Bắt buộc |

### Lưu ý khi chụp ảnh

Không đưa các thông tin sau vào ảnh báo cáo:

- MongoDB connection string.
- JWT secret.
- Email password.
- Groq API key.
- AWS Access Key hoặc Secret Access Key.
- Nội dung file `.env`.
- SSH private key.
- Cookie hoặc Authorization token trong Developer Tools.
