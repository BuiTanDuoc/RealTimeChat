# 💬 RealTimeChat

Ứng dụng chat thời gian thực full-stack xây dựng bằng **ASP.NET Core 8** và **React 18**.
Hỗ trợ chat riêng và chat nhóm, trạng thái online trực tiếp, biên nhận tin nhắn (đã gửi / đã nhận / đã đọc),
gửi file và ảnh, và dán văn bản hoặc ảnh từ clipboard.

## ✨ Tính năng

- 🔐 **JWT Authentication**: đăng ký / đăng nhập, access token (15 phút) + refresh token xoay vòng (7 ngày)
- 💬 **Chat riêng & nhóm**: mỗi cặp người dùng chỉ có một cuộc chat riêng; nhóm có tên và nhiều thành viên
- ⚡ **Real-time**: SignalR WebSocket, tin nhắn đến ngay lập tức, tự kết nối lại và đồng bộ
- 📎 **File & ảnh**: nút đính kèm, kéo thả, và **Ctrl+V** để dán ảnh chụp màn hình / ảnh đã copy (văn bản dán bình thường)
- 🟢 **Online presence**: online/offline + giờ truy cập cuối, tính đúng khi mở nhiều tab
- ✅ **Biên nhận**: ✓ đã gửi, ✓✓ đã nhận (người nhận đang online), ✓✓ xanh đã đọc
- 🤝 **Bạn bè**: tìm người, gửi / chấp nhận / từ chối / huỷ lời mời, danh sách bạn bè kèm trạng thái online, nhắn tin nhanh, huỷ kết bạn; lời mời đến theo thời gian thực
- 👤 **Hồ sơ**: đổi tên hiển thị, tải avatar, tìm người dùng
- 🏗️ **Clean Architecture**: Domain / Application / Infrastructure / API
- 📄 **Swagger UI** ở môi trường Development

## 🛠️ Tech stack

| Backend | Frontend |
|---|---|
| ASP.NET Core 8, SignalR | React 18 + Vite + TypeScript |
| EF Core + SQL Server | React Router v6 |
| ASP.NET Core Identity | @microsoft/signalr |
| JWT Bearer | Axios (tự refresh token khi 401) |
| AutoMapper | React Hook Form + Yup |
| Swagger / OpenAPI | Tailwind CSS 3, Lucide React, React Hot Toast |

## 🚀 Chạy dự án

Yêu cầu: .NET 8 SDK, Node.js 20+, SQL Server (LocalDB, Express hoặc Docker).

### 1. Backend

```bash
cd backend
# Sửa ConnectionStrings:Default trong src/RealTimeChat.API/appsettings.json nếu không dùng LocalDB
# Đổi Jwt:Key (>= 32 ký tự). Khuyến nghị dùng user-secrets:
dotnet user-secrets init --project src/RealTimeChat.API
dotnet user-secrets set "Jwt:Key" "<chuoi-bi-mat-dai-hon-32-ky-tu>" --project src/RealTimeChat.API

dotnet run --project src/RealTimeChat.API      # http://localhost:5000/swagger
```

Ở Development, database được tạo tự động (`EnsureCreated`). Với production hãy dùng migration:

```bash
dotnet ef migrations add Initial -p src/RealTimeChat.Infrastructure -s src/RealTimeChat.API
dotnet ef database update        -p src/RealTimeChat.Infrastructure -s src/RealTimeChat.API
```
(và xoá khối `EnsureCreatedAsync` + `DevSchemaPatches` trong `Program.cs`).

> `EnsureCreated` không sửa database đã tồn tại, nên bảng `Friendships` được tạo bổ sung (idempotent) bởi `DevSchemaPatches` khi chạy ở Development.

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

Mở hai trình duyệt (hoặc một cửa sổ ẩn danh), đăng ký hai tài khoản và chat thử.

## 🧱 Cấu trúc

```
backend/src
├─ RealTimeChat.Domain          Entities: AppUser, Conversation, Message, MessageReceipt, RefreshToken
├─ RealTimeChat.Application     DTOs, interfaces, AutoMapper profile, AppException
├─ RealTimeChat.Infrastructure  AppDbContext, Auth/User/Chat services, JWT, lưu file, PresenceTracker
└─ RealTimeChat.API             Controllers, ChatHub, middleware lỗi, Program.cs
frontend/src
├─ context/   AuthContext, ChatContext (SignalR + state)
├─ components/ Sidebar, ChatWindow, MessageBubble, MessageInput, NewChatModal, ProfileModal...
├─ pages/     AuthPages (Login/Register), ChatPage
└─ lib/       api.ts (Axios + refresh), helpers.ts
```

## 🔌 API

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/refresh`, `/logout` | Xác thực |
| GET/PUT | `/api/users/me` | Hồ sơ của tôi |
| POST | `/api/users/me/avatar` | Tải avatar (≤ 5 MB, ảnh) |
| GET | `/api/users/search?q=` | Tìm người dùng |
| GET | `/api/conversations` | Danh sách chat (kèm tin cuối, số chưa đọc) |
| POST | `/api/conversations/private`, `/group` | Tạo chat riêng / nhóm |
| GET | `/api/conversations/{id}/messages?before=&take=` | Lịch sử tin nhắn (phân trang) |
| GET | `/api/friends` | Danh sách bạn bè |
| GET/POST | `/api/friends/requests` | Lời mời đang chờ (đến + đi) / gửi lời mời `{userId}` |
| POST | `/api/friends/requests/{id}/accept` | Chấp nhận lời mời |
| DELETE | `/api/friends/requests/{id}` | Từ chối (người nhận) hoặc huỷ (người gửi) |
| DELETE | `/api/friends/{userId}` | Huỷ kết bạn |
| POST | `/api/files/upload` | Tải file đính kèm (≤ 25 MB) |

**Hub `/hubs/chat`**: client gọi `SendMessage`, `MarkAsRead`; server phát `ReceiveMessage`, `MessageStatus`,
`ConversationRead`, `ConversationCreated`, `FriendRequestReceived`, `FriendRequestAccepted`, `FriendRequestRemoved`, `FriendRemoved`, `OnlineUsers`, `UserOnline`, `UserOffline`.

## 🔒 Ghi chú bảo mật

- Token lưu trong `localStorage` (đơn giản, nhưng có thể bị đánh cắp nếu có lỗ hổng XSS). Có thể chuyển refresh token sang cookie `HttpOnly` nếu cần.
- File upload chặn các đuôi thực thi/HTML/SVG; chỉ ảnh được hiển thị inline, các file khác luôn tải về (`Content-Disposition: attachment`).
- Refresh token được băm SHA-256 trong DB và chỉ dùng được một lần.
- Hãy giới hạn quyền truy cập thư mục `uploads/` hoặc chuyển sang blob storage khi triển khai thật.
