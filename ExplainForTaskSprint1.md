# 🚀 PROJECT ROADMAP: AUTHENTICATION & AUTHORIZATION

## 📅 SPRINT 1: BACKEND (XÂY DỰNG NỀN MÓNG BẢO MẬT)

**Mục tiêu:** Server phải biết ai đang gửi request và họ có quyền hạn gì.

### 🔹 Phase 1.1: Database Schema & Setup (Nền tảng dữ liệu)

> **Lưu ý:** Đây là bước quan trọng nhất. Nếu thiết kế sai DB, việc sửa đổi sau này sẽ rất khó khăn.

* **Task 1.1.1: Install dependencies**
* `bcrypt`: Dùng để mã hóa mật khẩu. **Tuyệt đối không lưu mật khẩu thô vào DB.**
* `passport` & `jwt`: Thư viện chuẩn ngành để xử lý luồng đăng nhập.


* **Task 1.1.2: Prisma Schema**
* Tạo 3 bảng chính: `User` (lưu thông tin), `Role` (quyền hạn: Admin, Waiter...), và `UserRole` (bảng trung gian).
* *Tại sao cần bảng trung gian `UserRole`?* Để một người có thể giữ nhiều vai trò (Ví dụ: Một ông chủ vừa là Admin vừa có thể xuống bếp làm Kitchen).


* **Task 1.1.5: Seed Data**
* Tạo sẵn tài khoản **Super Admin** đầu tiên.
* Nếu không làm bước này, sau khi code xong tính năng đăng nhập, bạn sẽ không có tài khoản nào để test.



### 🔹 Phase 1.2: Auth Module (Trái tim của bảo mật)

Đây là nơi xử lý logic "Bạn là ai?".

* **Task 1.2.2: DTOs (Data Transfer Objects)**
* Kiểm tra dữ liệu đầu vào (Validation).
* Ví dụ: Email phải đúng định dạng, Password phải trên 6 ký tự. Giúp API không bị lỗi bởi dữ liệu rác.


* **Task 1.2.3: JWT Strategy**
* Đóng vai trò là **"người soát vé"**.
* Mỗi khi Frontend gửi request kèm Token, file này sẽ chạy để kiểm tra xem Token có hợp lệ không, có hết hạn chưa.


* **Task 1.2.4: Guards & Decorators**
* `JwtAuthGuard`: Cái khiên chắn cấp 1. Đặt trước API nào thì API đó bắt buộc phải đăng nhập mới gọi được.
* `RolesGuard`: Cái khiên cấp 2. Kiểm tra xem user có đúng quyền (ví dụ: chỉ `'admin'`) mới được truy cập.
* `@CurrentUser`: Decorator giúp lấy thông tin user đang đăng nhập ngay trong Controller mà không cần query lại DB.


* **Task 1.2.5: Auth Service**
* Chứa hàm `login` (kiểm tra pass, ký token) và `register` (tạo user mới).



### 🔹 Phase 1.3: Users Module (Quản lý nhân sự)

Nếu Auth Module là để "Vào cửa", thì Users Module là để "Quản lý hồ sơ".

* **Task 1.3.3: User Service**
* Thực hiện CRUD (Thêm, Xem, Sửa, Xóa) nhân viên.
* **Quan trọng:** Logic tạo user ở đây phức tạp hơn bình thường vì phải gán `Role` cho họ ngay khi tạo.


* **Task 1.3.4: User Controller**
* Các API này sẽ được bảo vệ bởi Guard bạn viết ở Phase 1.2.
* Chỉ **Super Admin** mới được quyền tạo hoặc xóa nhân viên.



### 🔹 Phase 1.4: Protect APIs (Lắp khóa cho nhà)

* Trước đây các API `Menu`, `Tables` là Public (ai gọi cũng được).
* Hành động: Gắn `JwtAuthGuard` vào để bắt buộc phải có Token mới lấy được dữ liệu.

---

## 📅 SPRINT 2: FRONTEND (GIAO DIỆN & TÍCH HỢP)

**Mục tiêu:** Frontend tự động xử lý token và hiển thị đúng giao diện theo quyền hạn.

### 🔸 Phase 2.1: Auth Context & Setup (Bộ não của Frontend)

* **Task 2.1.2: Axios Interceptor**
* **Cực kỳ quan trọng:** Thay vì mỗi lần gọi API phải thủ công thêm headers: `{ Authorization: Bearer token }`, Interceptor sẽ tự động chèn token vào mọi request.
* Tự động đá người dùng ra trang login nếu token hết hạn (lỗi `401`).


* **Task 2.1.3: Auth Context**
* Lưu trạng thái đăng nhập (`user`, `isAuthenticated`) vào một biến toàn cục (**Global State**).
* Giúp bất kỳ component nào trong app (Header, Sidebar...) đều biết user đang là ai để hiển thị đúng tên/avatar.


* **Task 2.1.4: Protected Route**
* Một Component bao bọc các trang Admin.
* Nếu chưa đăng nhập mà cố tình gõ URL `/admin/dashboard`, nó sẽ chặn lại và đá về trang Login.



### 🔸 Phase 2.2: Login Page (Cửa ngõ)

* Giao diện để nhập Email/Pass.
* **Luồng xử lý:** Nhấn Login → Gọi API → Nhận Token → Lưu vào `LocalStorage` → Cập nhật `AuthContext` → Chuyển hướng vào trong App.

### 🔸 Phase 2.3: App & Navigation

Phân chia luồng hiển thị:

* **Khách vãng lai:** Chỉ thấy trang Login (hoặc trang Menu khách hàng sau này).
* **Admin:** Thấy full menu quản lý.
* **Waiter:** Chỉ thấy menu gọi món/bàn.

### 🔸 Phase 2.4: User Management Page (Trang quản trị)

* Giao diện để Admin nhìn thấy danh sách nhân viên, biết ai là Waiter, ai là Kitchen.
* Tính năng tạo tài khoản mới cho nhân viên.
