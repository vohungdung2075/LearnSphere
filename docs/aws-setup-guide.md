# LearnSphere — Hướng dẫn Thiết lập AWS Infrastructure

Tài liệu này hướng dẫn từng bước thiết lập hạ tầng AWS cho dự án LearnSphere.
Thực hiện đúng thứ tự từ Bước 1 đến Bước 9.

---

## Bước 0 — Xử lý bảo mật khẩn cấp

> ⚠️ **QUAN TRỌNG**: Nếu bạn đã lỡ commit file `.env` chứa credentials thật lên GitHub, làm ngay các bước sau trước khi tiếp tục:

1. Vào [AWS IAM Console](https://console.aws.amazon.com/iam/home#/users)
2. Chọn user → tab **Security credentials**
3. Tìm Access Key bị lộ → nhấn **Deactivate** rồi **Delete**
4. Không tạo key mới cho GitHub hoặc EC2. Hai thành phần này sẽ dùng IAM Role với credential tạm thời.

---

## Bước 1 — Tạo IAM Role OIDC cho GitHub Actions

> Không tạo Access Key dài hạn. GitHub Actions nhận credential tạm thời qua OIDC.

1. Vào **IAM → Identity providers → Add provider**:
   - Provider type: `OpenID Connect`
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. Tạo role `LearnSphereGitHubDeployRole`, trusted entity là provider trên. Trust policy phải giới hạn đúng repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:vohungdung2075@206133613/LearnSphere@1307532910:ref:refs/heads/main"
      }
    }
  }]
}
```

Repository này được tạo sau ngày GitHub chuyển repository mới sang immutable OIDC
subject, nên `sub` phải có cả owner ID và repository ID như trên. Nếu dùng
repository khác, lấy claim thực tế bằng OIDC debugger của GitHub thay vì sao chép
hai ID này.

3. Gắn policy tối thiểu cho đúng ECR repository, bucket frontend và CloudFront distribution đang dùng:
   - ECR: lấy authorization token, upload layer và push image.
   - S3 frontend: list bucket, put/get/delete object.
   - CloudFront: `cloudfront:CreateInvalidation`, `cloudfront:GetDistribution`.
   - Systems Manager: gửi `AWS-RunShellScript` đến đúng EC2 instance và đọc kết quả lệnh.

Không dùng `AmazonS3FullAccess`, `CloudFrontFullAccess` hoặc Access Key dài hạn.

---

## Bước 2 — Tạo IAM Role cho EC2 Instance

> Mục tiêu: EC2 tự dùng IAM Role để truy cập S3 và ECR — không cần Access Key trong `.env`.

1. Vào **IAM → Roles → Create role**
   - Trusted entity: **AWS service → EC2**
   - Tên role: `LearnSphereEc2Role`

2. Gắn các policy:
   - Quyền S3 giới hạn theo bucket: `ListBucket`, `PutObject`, `GetObject`, `DeleteObject` và `AbortMultipartUpload`
   - `AmazonEC2ContainerRegistryReadOnly` — để pull image từ ECR
   - `AmazonSSMManagedInstanceCore` — để GitHub deploy qua Systems Manager, không cần SSH
   - Quyền CloudWatch Logs giới hạn vào log group `/learnsphere/backend`
   - Bedrock: `bedrock:InvokeModel` và `bedrock:InvokeModelWithResponseStream` trên model/inference profile sử dụng

3. Nhớ tên role này để gắn vào EC2 ở Bước 4.

---

## Bước 3 — Cấu hình S3 Buckets

### 3a. Bucket Media (tạo mới)

1. Tạo bucket private có tên duy nhất, ví dụ `learnsphere-media-<UNIQUE_SUFFIX>`.
2. Giữ **Block all public access** bật và không bật Static Website Hosting.
3. Vào **Permissions → CORS** và dán cấu hình:

Vào **S3 → Bucket → Permissions → CORS** và dán cấu hình:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://CLOUDFRONT_DOMAIN.cloudfront.net"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Thay `CLOUDFRONT_DOMAIN` bằng domain CloudFront thật sau khi tạo ở Bước 6.
>
> `ExposeHeaders: ["ETag"]` là bắt buộc để trình duyệt hoàn tất multipart upload.

### 3b. Bucket Frontend Static Hosting (tạo mới)

1. Vào **S3 → Create bucket**
   - Bucket name: `learnsphere-fe-<UNIQUE_SUFFIX>` (phải là tên duy nhất toàn cầu)
   - Region: `ap-southeast-1`
   - Giữ **Block all public access** ở trạng thái bật

2. Không cần bật S3 Static Website Hosting. CloudFront sẽ đọc bucket riêng tư bằng OAC.

3. Sau khi tạo CloudFront ở Bước 6, dùng bucket policy mà CloudFront gợi ý cho OAC. Không thêm `Principal: "*"`.

---

## Bước 4 — Tạo ECR Repository

1. Vào **ECR → Create repository**
   - Visibility: **Private**
   - Repository name: `learnsphere-be`
   - Image scanning: **Scan on push** ✅
   - Region: `ap-southeast-1`

2. Ghi lại **Repository URI** (dạng: `123456789.dkr.ecr.ap-southeast-1.amazonaws.com/learnsphere-be`)

3. Thêm lifecycle policy giữ khoảng 10 image SHA gần nhất để có thể rollback nhưng không tăng chi phí vô hạn.

---

## Bước 5 — Launch EC2 Instance

1. Vào **EC2 → Launch Instance**

   | Setting | Giá trị |
   |---|---|
   | AMI | Amazon Linux 2023 (64-bit) |
   | Instance type | `t3.micro` (Free Tier) hoặc `t3.small` |
   | Key pair | Proceed without a key pair; quản trị qua Systems Manager |
   | VPC | Default VPC |
   | Subnet | Public subnet |
   | Auto-assign public IP | Enable |
   | IAM Instance Profile | `LearnSphereEc2Role` (Bước 2) |

2. **Security Group** — Inbound rules:

   | Type | Port | Source | Mục đích |
   |---|---|---|---|
   | Custom TCP | 5000 | Prefix list `com.amazonaws.global.cloudfront.origin-facing` | CloudFront gọi Backend API |

Không mở port `22`, `80`, `443` hoặc `5000` cho `0.0.0.0/0`.

3. **Sau khi launch** → ghi lại **Instance ID** và **Public IPv4 DNS**

### Cài đặt môi trường trên EC2

Vào **EC2 → Instances → chọn instance → Connect → Session Manager → Connect**, rồi chạy:

```bash
# 1. Cài Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 2. Cài AWS CLI (thường đã có trên Amazon Linux 2023)
aws --version

# 3. Tạo file .env trên server (KHÔNG commit lên Git)
sudo touch /home/ec2-user/.env
sudo chmod 600 /home/ec2-user/.env
sudo vi /home/ec2-user/.env
# Điền nội dung từ .env.example

# 4. Test pull image từ ECR (sau khi push lần đầu qua CI/CD)
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin <ECR_REGISTRY>
```

---

## Bước 6 — Tạo CloudFront Distributions

### Distribution 1: Frontend (S3 Static)

1. Vào **CloudFront → Create distribution**

   | Setting | Giá trị |
   |---|---|
   | Origin domain | Chọn bucket `learnsphere-fe-<UNIQUE_SUFFIX>` |
   | Origin access | **Origin access control (OAC)** |
   | Default root object | `index.html` |
   | Viewer protocol policy | Redirect HTTP to HTTPS |
   | Price class | Use only North America, Europe, Asia (rẻ hơn) |

2. Không tạo Custom Error Response `403/404 → /index.html`. Cấu hình đó áp dụng cho toàn
   distribution và có thể biến lỗi thật của `/api/*` thành HTML với status `200`.

   Tạo một **CloudFront Function** ở sự kiện `Viewer request` và chỉ gắn vào default
   behavior của S3:

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith("/") || !uri.split("/").pop().includes(".")) {
    request.uri = "/index.html";
  }

  return request;
}
```

   Behavior `/api/*` không được gắn function này.

3. Sau khi tạo → ghi lại **Distribution ID** và **Domain name** (`dxxxx.cloudfront.net`)

4. Gắn **Elastic IP** cho EC2, sau đó thêm origin backend vào cùng distribution:
   - Origin domain: Public DNS/Elastic IP DNS của EC2.
   - Origin protocol: HTTP only.
   - HTTP port: `5000`.
   - Cache behavior path: `/api/*`.
   - Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE.
   - Cache policy: `CachingDisabled`.
   - Origin request policy: `AllViewerExceptHostHeader` để chuyển tiếp Authorization và request headers.

Frontend dùng `VITE_API_BASE_URL=/api`, vì vậy trình duyệt chỉ gọi HTTPS cùng domain CloudFront; CloudFront mới chuyển request vào EC2. Không cấu hình URL `http://EC2_IP:5000/api` trong frontend.

5. Security Group port 5000 chỉ nên nhận traffic từ AWS managed prefix list `com.amazonaws.global.cloudfront.origin-facing`, không mở cho toàn Internet.

6. Thêm lifecycle rule cho prefix `assets/` của bucket frontend để xóa các asset không còn dùng sau khoảng 30 ngày. Workflow cố ý giữ asset của bản trước để việc publish `index.html` luôn an toàn.

### Media/Assets

Giai đoạn đầu không cần CloudFront riêng cho media. Browser upload/download trực tiếp qua
presigned URL có thời hạn do backend cấp; bucket media vẫn private. Có thể thêm CDN cho
video sau khi ứng dụng đã chạy ổn định.

---

## Bước 7 — Cài GitHub Secrets

Vào **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Cách lấy giá trị |
|---|---|
| `AWS_GITHUB_ROLE_ARN` | ARN của role OIDC `LearnSphereGitHubDeployRole` |
| `EC2_INSTANCE_ID` | Instance ID dạng `i-0123456789abcdef0` dùng cho Systems Manager |
| `VITE_API_BASE_URL` | `/api` |
| `S3_FE_BUCKET` | `learnsphere-fe-<UNIQUE_SUFFIX>` |
| `CLOUDFRONT_FE_DISTRIBUTION_ID` | ID của CloudFront FE distribution |

---

## Bước 8 — Cài CloudWatch Alarms

Vào **CloudWatch → Alarms → Create alarm**:

### Alarm 1: CPU cao
- Metric: `EC2 → Per-Instance Metrics → CPUUtilization`
- Condition: > 80% trong 2 periods (10 phút)
- Action: Gửi email qua SNS

### Alarm 2: Instance ngừng hoạt động
- Metric: `EC2 → Per-Instance Metrics → StatusCheckFailed`
- Condition: >= 1
- Action: Gửi email qua SNS

### Log Group: Backend logs
- Container sẽ tự đẩy logs lên `/learnsphere/backend` (đã cấu hình trong `deploy.yml`)
- Có thể xem logs tại: **CloudWatch → Log groups → /learnsphere/backend**

---

## Bước 9 — Trigger CI/CD lần đầu

```bash
# Commit tất cả file đã kiểm tra
git add .
git commit -m "feat: prepare LearnSphere AWS deployment"
git push origin main
```

Workflow đang để chế độ thủ công. Vào **GitHub → Actions → Deploy LearnSphere to AWS →
Run workflow**. GitHub Actions sẽ:

1. Build Docker image → Push lên ECR
2. Gửi lệnh qua Systems Manager → EC2 pull image → thay container có rollback
3. Build React → Upload S3 → Invalidate CloudFront

Theo dõi tại: **GitHub → Actions tab** → xem log từng step.

---

## Kiểm tra sau khi deploy

```bash
# 1. Mở EC2 Session Manager rồi kiểm tra container
docker ps

# 2. Kiểm tra logs
docker logs learnsphere-be --tail 50

# 3. Test API
curl http://127.0.0.1:5000/health/ready
# → {"status":"ready","database":"connected"}

# 4. Kiểm tra Frontend
# Truy cập: https://CLOUDFRONT_DOMAIN.cloudfront.net
```
