# 💳 TASK 3.1: TÍCH HỢP THANH TOÁN - PHIÊN BẢN BATCH PAYMENT

> **Thời gian ước tính:** 16-18 giờ  
> **Độ ưu tiên:** Critical  
> **Cập nhật:** 14/01/2026 - Thêm Git Workflow + Chi tiết Phase 3

---

## 🔀 GIT WORKFLOW CHO TASK NÀY

### **Branch:**
```bash
git checkout develop && git pull
git checkout -b feature/sprint3-task-3.1-batch-payment
```

### **Commits theo Phase:**

| Phase | Commits | Est. Time |
|-------|---------|-----------|
| 1 | `feat(database): add bill_requests and payments migration` | 1h |
| 2 | `feat(bill-request): implement service and controller` | 3h |
| 3 | `feat(payment): implement 4 gateway services` | 6h |
| 3 | `feat(payment): implement PaymentsService core methods` | 3h |
| 4 | `feat(socket): add bill request and payment events` | 2h |
| 5 | `test(payment): add unit tests for services` | 2h |
| 5 | `docs(payment): update env variables and README` | 1h |

### **Merge khi hoàn thành:**
```bash
git push origin feature/sprint3-task-3.1-batch-payment
# Create PR → Review → Merge to develop
```

---

## 📋 THAY ĐỔI SO VỚI PHIÊN BẢN CŨ

| Phiên bản cũ             | Phiên bản mới (Batch Payment)                  |
| ------------------------ | ---------------------------------------------- |
| 1 order → 1 payment      | N orders → 1 payment (gộp bill)                |
| Customer tự thanh toán   | Customer request → Waiter confirm → Thanh toán |
| Không có tips            | Có tips (tiền boa)                             |
| QR hiển thị cho customer | QR hiển thị ở màn hình Waiter                  |
| Không có bill_requests   | Thêm bảng `bill_requests`                      |

---

## 🎯 FLOW MỚI: BILL REQUEST

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Customer ăn xong → Bấm "Request Bill" (Yêu cầu thanh toán)              │
│  2. Modal hiện: Chọn Payment Method + Nhập Tips + Note                      │
│  3. Bấm "Submit" → API tạo Bill Request                                      │
│  4. Màn hình Customer: "Đang chờ waiter xác nhận..."                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WAITER FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Socket.IO: Alert "Bàn 5 yêu cầu thanh toán - 350,000đ + 50,000đ tips"   │
│  2. Waiter xem chi tiết bill request                                         │
│  3. Bấm "Accept Payment Request"                                             │
│  4. Màn hình Waiter hiển thị:                                               │
│     - Nếu MoMo/ZaloPay/VNPay: QR code để customer scan                      │
│     - Nếu Cash: Form nhập số tiền nhận, tiền thối                           │
│  5. Waiter đưa QR cho customer scan HOẶC nhận tiền mặt                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT COMPLETION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Online: Gateway callback → Update payment & orders → Notify              │
│  - Cash: Waiter confirm → Update payment & orders → Notify                  │
│  - Tất cả orders của bàn đó → status = "completed"                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE SCHEMA MỚI

### **1. Bảng `bill_requests` (MỚI)**

```sql
-- Migration: YYYYMMDD_add_bill_requests.sql

CREATE TABLE bill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liên kết
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,

  -- Thông tin thanh toán
  payment_method_code VARCHAR(20) NOT NULL, -- 'momo', 'zalopay', 'vnpay', 'cash'
  subtotal DECIMAL(12, 2) NOT NULL,         -- Tổng tiền orders
  tips_amount DECIMAL(12, 2) DEFAULT 0,     -- Tiền tips
  total_amount DECIMAL(12, 2) NOT NULL,     -- subtotal + tips

  -- Danh sách orders được gộp (JSON array of UUIDs)
  order_ids JSONB NOT NULL, -- ["uuid1", "uuid2", "uuid3"]

  -- Customer note
  customer_note TEXT,

  -- Trạng thái
  status VARCHAR(20) DEFAULT 'pending',
  -- pending: Chờ waiter accept
  -- accepted: Waiter đã accept, đang chờ thanh toán
  -- completed: Thanh toán thành công
  -- cancelled: Customer/Waiter hủy

  -- Waiter xử lý
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes cho performance
CREATE INDEX idx_bill_requests_table ON bill_requests(table_id);
CREATE INDEX idx_bill_requests_status ON bill_requests(status);
CREATE INDEX idx_bill_requests_restaurant ON bill_requests(restaurant_id);
CREATE INDEX idx_bill_requests_created ON bill_requests(created_at);

-- Compound index cho query: "Lấy pending bill requests của restaurant"
CREATE INDEX idx_bill_requests_restaurant_status ON bill_requests(restaurant_id, status);
```

### **2. Cập nhật bảng `payments`**

```sql
-- Thêm cột vào payments để liên kết với bill_request

ALTER TABLE payments
ADD COLUMN bill_request_id UUID REFERENCES bill_requests(id),
ADD COLUMN merged_order_ids JSONB, -- Backup list order IDs
ADD COLUMN tips_amount DECIMAL(12, 2) DEFAULT 0;

-- Cho phép order_id nullable (vì giờ dùng merged_order_ids)
ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;

-- Index
CREATE INDEX idx_payments_bill_request ON payments(bill_request_id);
```

### **3. Prisma Schema**

```prisma
// schema.prisma - Thêm model mới

model BillRequest {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  restaurant_id     String   @db.Uuid
  table_id          String   @db.Uuid
  payment_method_code String @db.VarChar(20)
  subtotal          Decimal  @db.Decimal(12, 2)
  tips_amount       Decimal  @default(0) @db.Decimal(12, 2)
  total_amount      Decimal  @db.Decimal(12, 2)
  order_ids         Json     // Array of order UUIDs
  customer_note     String?
  status            String   @default("pending") @db.VarChar(20)
  accepted_by       String?  @db.Uuid
  accepted_at       DateTime? @db.Timestamp(6)
  created_at        DateTime @default(now()) @db.Timestamp(6)
  updated_at        DateTime @updatedAt @db.Timestamp(6)

  // Relations
  restaurant        Restaurant @relation(fields: [restaurant_id], references: [id], onDelete: Cascade)
  table             Table      @relation(fields: [table_id], references: [id], onDelete: Cascade)
  waiter            User?      @relation(fields: [accepted_by], references: [id])
  payment           Payment?   // 1-1 với payment sau khi thanh toán

  @@index([table_id])
  @@index([status])
  @@index([restaurant_id])
  @@index([restaurant_id, status])
  @@map("bill_requests")
}
```

---

## 📁 CẤU TRÚC CODE HIỆN TẠI

```
backend/src/
├── bill-requests/                    # 🆕 MODULE MỚI (Phase 2)
│   ├── bill-requests.module.ts       ✅ Đã tạo
│   ├── bill-requests.controller.ts   ✅ Đã tạo
│   ├── bill-requests.service.ts      ✅ Đã implement
│   └── dto/
│       ├── create-bill-request.dto.ts       ⏳ Cần tạo
│       ├── accept-bill-request.dto.ts       ⏳ Cần tạo (optional)
│       └── bill-request-response.dto.ts     ⏳ Cần tạo
│
├── payments/                         # 🔄 CẬP NHẬT (Phase 3, 5)
│   ├── payments.module.ts            ✅ Đã có (có providers)
│   ├── payments.controller.ts        ✅ Đã có
│   ├── payments.service.ts           ❌ EMPTY - CẦN IMPLEMENT
│   │
│   ├── momo/
│   │   └── momo.service.ts           ❌ EMPTY - CẦN IMPLEMENT
│   ├── zalopay/
│   │   └── zalopay.service.ts        ❌ EMPTY - CẦN IMPLEMENT
│   ├── vnpay/
│   │   └── vnpay.service.ts          ❌ EMPTY - CẦN IMPLEMENT
│   ├── cash/
│   │   └── cash.service.ts           ❌ EMPTY - CẦN IMPLEMENT
│   │
│   └── dto/
│       ├── momo-callback.dto.ts      ⏳ Cần tạo
│       ├── zalopay-callback.dto.ts   ⏳ Cần tạo
│       ├── vnpay-ipn.dto.ts          ⏳ Cần tạo
│       └── cash-confirm.dto.ts       ⏳ Cần tạo
│
└── notifications/                    # 🔄 CẬP NHẬT (Phase 4)
    └── notifications.gateway.ts      ⏳ Thêm methods mới
```

### **🚨 SERVICES CẦN IMPLEMENT:**

| Service             | File                         | Trạng thái | Priority    |
| ------------------- | ---------------------------- | ---------- | ----------- |
| **PaymentsService** | `payments.service.ts`        | ❌ Empty   | 🔴 Critical |
| **MoMoService**     | `momo/momo.service.ts`       | ❌ Empty   | 🔴 Critical |
| **ZaloPayService**  | `zalopay/zalopay.service.ts` | ❌ Empty   | 🟡 High     |
| **VNPayService**    | `vnpay/vnpay.service.ts`     | ❌ Empty   | 🟡 High     |
| **CashService**     | `cash/cash.service.ts`       | ❌ Empty   | 🟢 Medium   |

---

## 🔌 API ENDPOINTS

### **1. Bill Request APIs (Customer)**

```typescript
// Customer tạo yêu cầu thanh toán
POST /api/bill-requests
Authorization: Bearer <customer_token> hoặc QR Session
Body: {
  table_id: "uuid",
  payment_method: "momo" | "zalopay" | "vnpay" | "cash",
  tips_amount: 50000,  // Optional
  customer_note: "Cảm ơn!" // Optional
}
Response: {
  id: "uuid",
  subtotal: 350000,
  tips_amount: 50000,
  total_amount: 400000,
  order_count: 3,
  status: "pending",
  message: "Yêu cầu đã được gửi. Vui lòng chờ waiter xác nhận."
}

// Customer xem trạng thái bill request
GET /api/bill-requests/:id/status
Response: {
  id: "uuid",
  status: "pending" | "accepted" | "completed" | "cancelled",
  waiter_name: "Nguyễn Văn A",  // Nếu đã accept
  accepted_at: "2026-01-13T10:30:00Z"
}

// Customer hủy bill request (chỉ khi status = pending)
DELETE /api/bill-requests/:id
```

### **2. Bill Request APIs (Waiter)**

```typescript
// Waiter lấy danh sách bill requests của restaurant
GET /api/bill-requests?status=pending
Authorization: Bearer <waiter_token>
Response: {
  data: [
    {
      id: "uuid",
      table_number: "5",
      total_amount: 400000,
      tips_amount: 50000,
      payment_method: "momo",
      order_count: 3,
      customer_note: "Cảm ơn!",
      created_at: "2026-01-13T10:25:00Z"
    }
  ]
}

// Waiter xem chi tiết bill request
GET /api/bill-requests/:id
Response: {
  id: "uuid",
  table: { id, table_number, location },
  orders: [
    { id, order_number, items: [...], subtotal: 150000 },
    { id, order_number, items: [...], subtotal: 200000 }
  ],
  subtotal: 350000,
  tips_amount: 50000,
  total_amount: 400000,
  payment_method: "momo",
  status: "pending"
}

// Waiter accept bill request → Tạo payment + Generate QR
POST /api/bill-requests/:id/accept
Authorization: Bearer <waiter_token>
Response: {
  bill_request_id: "uuid",
  payment_id: "uuid",
  payment_method: "momo",
  total_amount: 400000,

  // Nếu MoMo/ZaloPay/VNPay:
  qr_code_url: "https://...",      // URL ảnh QR
  qr_code_data: "00020101...",     // Raw QR data
  pay_url: "https://...",          // Deep link
  expires_at: "2026-01-13T10:40:00Z",

  // Nếu Cash:
  awaiting_cash_confirmation: true
}

// Waiter reject/cancel bill request
POST /api/bill-requests/:id/reject
Body: { reason: "Bàn không có khách" }
```

### **3. Payment APIs (Callbacks)**

```typescript
// Gateway callbacks - KHÔNG ĐỔI
POST /api/payments/momo/callback     // MoMo webhook
POST /api/payments/zalopay/callback  // ZaloPay callback
POST /api/payments/vnpay/ipn         // VNPay IPN

// Cash confirmation - Waiter
POST /api/payments/cash/confirm
Authorization: Bearer <waiter_token>
Body: {
  payment_id: "uuid",
  cash_received: 500000,
  change_given: 100000,
  notes: "Khách đưa 500k"
}
```

---

## 🔔 SOCKET.IO EVENTS

### **Events mới cho Bill Request:**

```typescript
// ========================================
// CUSTOMER → SERVER
// ========================================

// Customer tạo bill request (optional, có thể dùng REST API)
socket.emit("bill_request:create", {
  table_id: "uuid",
  payment_method: "momo",
  tips_amount: 50000,
});

// ========================================
// SERVER → WAITER
// ========================================

// Khi customer tạo bill request
socket.emit("bill_request:new", {
  id: "uuid",
  table_number: "5",
  table_location: "Tầng 1 - Góc cửa sổ",
  total_amount: 400000,
  tips_amount: 50000,
  payment_method: "momo",
  order_count: 3,
  customer_note: "Cảm ơn!",
  created_at: "2026-01-13T10:25:00Z",
});

// ========================================
// SERVER → CUSTOMER
// ========================================

// Khi waiter accept bill request
socket.emit("bill_request:accepted", {
  bill_request_id: "uuid",
  waiter_name: "Nguyễn Văn A",
  message: "Waiter đang xử lý thanh toán của bạn",
});

// Khi payment hoàn tất
socket.emit("payment:completed", {
  bill_request_id: "uuid",
  payment_id: "uuid",
  total_amount: 400000,
  payment_method: "momo",
  message: "Thanh toán thành công! Cảm ơn quý khách.",
});

// ========================================
// SERVER → ADMIN
// ========================================

// Payment completed notification
socket.emit("payment:received", {
  table_number: "5",
  amount: 400000,
  tips: 50000,
  method: "MoMo",
  waiter: "Nguyễn Văn A",
});
```

---

## 📝 DTOs CHI TIẾT

### **1. create-bill-request.dto.ts**

```typescript
import {
  IsUUID,
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBillRequestDto {
  @ApiProperty({ description: "ID của bàn" })
  @IsUUID()
  table_id: string;

  @ApiProperty({
    description: "Phương thức thanh toán",
    enum: ["momo", "zalopay", "vnpay", "cash"],
  })
  @IsString()
  @IsIn(["momo", "zalopay", "vnpay", "cash"])
  payment_method: string;

  @ApiPropertyOptional({ description: "Tiền tips (VND)", default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tips_amount?: number = 0;

  @ApiPropertyOptional({ description: "Ghi chú của khách" })
  @IsOptional()
  @IsString()
  customer_note?: string;
}
```

### **2. accept-bill-request.dto.ts**

```typescript
import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AcceptBillRequestDto {
  @ApiProperty({ description: "ID của bill request" })
  @IsUUID()
  bill_request_id: string;
}
```

### **3. bill-request-response.dto.ts**

```typescript
import { ApiProperty } from "@nestjs/swagger";

export class BillRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  table_number: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  tips_amount: number;

  @ApiProperty()
  total_amount: number;

  @ApiProperty()
  order_count: number;

  @ApiProperty()
  payment_method: string;

  @ApiProperty()
  status: "pending" | "accepted" | "completed" | "cancelled";

  @ApiProperty()
  customer_note?: string;

  @ApiProperty()
  created_at: Date;
}

export class AcceptBillRequestResponseDto {
  @ApiProperty()
  bill_request_id: string;

  @ApiProperty()
  payment_id: string;

  @ApiProperty()
  payment_method: string;

  @ApiProperty()
  total_amount: number;

  // For online payments
  @ApiProperty({ required: false })
  qr_code_url?: string;

  @ApiProperty({ required: false })
  qr_code_data?: string;

  @ApiProperty({ required: false })
  pay_url?: string;

  @ApiProperty({ required: false })
  expires_at?: Date;

  // For cash
  @ApiProperty({ required: false })
  awaiting_cash_confirmation?: boolean;
}
```

---

## 🔧 SERVICE LOGIC

### **BillRequestsService - Core Logic**

```typescript
// bill-requests.service.ts

@Injectable()
export class BillRequestsService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsGateway: NotificationsGateway
  ) {}

  /**
   * Customer tạo bill request
   * Query TỐI ƯU - Chỉ lấy orders chưa thanh toán
   */
  async createBillRequest(dto: CreateBillRequestDto, customerId?: string) {
    // ⚡ QUERY TỐI ƯU: Dùng WHERE clause, không fetch all rồi filter
    const unpaidOrders = await this.prisma.order.findMany({
      where: {
        table_id: dto.table_id,
        status: { in: ["pending", "accepted", "preparing", "ready", "served"] },
        // KHÔNG lấy completed, cancelled, rejected
      },
      select: {
        id: true,
        order_number: true,
        total: true,
        status: true,
      },
      orderBy: { created_at: "asc" },
    });

    if (unpaidOrders.length === 0) {
      throw new BadRequestException("Không có order nào cần thanh toán");
    }

    // Kiểm tra xem có bill request pending nào không
    const existingRequest = await this.prisma.billRequest.findFirst({
      where: {
        table_id: dto.table_id,
        status: "pending",
      },
    });

    if (existingRequest) {
      throw new BadRequestException("Đã có yêu cầu thanh toán đang chờ xử lý");
    }

    // Tính tổng tiền
    const subtotal = unpaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
    const tipsAmount = dto.tips_amount || 0;
    const totalAmount = subtotal + tipsAmount;

    // Lấy restaurant_id từ table
    const table = await this.prisma.table.findUnique({
      where: { id: dto.table_id },
      select: { restaurant_id: true, table_number: true },
    });

    // Tạo bill request
    const billRequest = await this.prisma.billRequest.create({
      data: {
        restaurant_id: table.restaurant_id,
        table_id: dto.table_id,
        payment_method_code: dto.payment_method,
        subtotal,
        tips_amount: tipsAmount,
        total_amount: totalAmount,
        order_ids: unpaidOrders.map((o) => o.id), // JSON array
        customer_note: dto.customer_note,
        status: "pending",
      },
    });

    // 🔔 Notify waiters của restaurant này
    this.notificationsGateway.notifyWaiters(
      table.restaurant_id,
      "bill_request:new",
      {
        id: billRequest.id,
        table_number: table.table_number,
        total_amount: totalAmount,
        tips_amount: tipsAmount,
        payment_method: dto.payment_method,
        order_count: unpaidOrders.length,
        customer_note: dto.customer_note,
        created_at: billRequest.created_at,
      }
    );

    return {
      id: billRequest.id,
      subtotal,
      tips_amount: tipsAmount,
      total_amount: totalAmount,
      order_count: unpaidOrders.length,
      status: "pending",
      message: "Yêu cầu đã được gửi. Vui lòng chờ waiter xác nhận.",
    };
  }

  /**
   * Waiter accept bill request → Generate payment + QR
   */
  async acceptBillRequest(billRequestId: string, waiterId: string) {
    const billRequest = await this.prisma.billRequest.findUnique({
      where: { id: billRequestId },
      include: { table: true },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request không tồn tại");
    }

    if (billRequest.status !== "pending") {
      throw new BadRequestException("Bill request đã được xử lý");
    }

    // Update bill request status
    await this.prisma.billRequest.update({
      where: { id: billRequestId },
      data: {
        status: "accepted",
        accepted_by: waiterId,
        accepted_at: new Date(),
      },
    });

    // Tạo payment và generate QR (nếu online payment)
    const paymentResult =
      await this.paymentsService.initiatePaymentFromBillRequest({
        bill_request_id: billRequestId,
        payment_method: billRequest.payment_method_code,
        amount: Number(billRequest.total_amount),
        tips_amount: Number(billRequest.tips_amount),
        order_ids: billRequest.order_ids as string[],
      });

    // 🔔 Notify customer
    this.notificationsGateway.notifyTable(
      billRequest.table_id,
      "bill_request:accepted",
      {
        bill_request_id: billRequestId,
        waiter_name: "Waiter", // TODO: Get waiter name
        message: "Waiter đang xử lý thanh toán của bạn",
      }
    );

    return {
      bill_request_id: billRequestId,
      payment_id: paymentResult.payment_id,
      payment_method: billRequest.payment_method_code,
      total_amount: Number(billRequest.total_amount),
      ...paymentResult, // QR code, pay_url, etc.
    };
  }
}
```

---

## 🔨 IMPLEMENTATION CHI TIẾT - TỪNG BƯỚC

---

## ✅ PHASE 1: DATABASE MIGRATION (2h)

### **Bước 1.1: Cập nhật Prisma Schema**

**File:** `backend/prisma/schema.prisma`

**Tìm model `Payment` (dòng ~340) và thêm 3 fields mới:**

```prisma
model payments {
  id                                String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_id                          String?         @db.Uuid  // ⬅️ ĐỔI: Thêm ? để nullable
  payment_method_id                 String          @db.Uuid
  amount                            Decimal         @db.Decimal(10, 2)

  // 🆕 THÊM 3 FIELDS MỚI
  bill_request_id                   String?         @db.Uuid
  merged_order_ids                  Json?           // Array of order UUIDs
  tips_amount                       Decimal?        @default(0) @db.Decimal(10, 2)

  // ... các fields khác giữ nguyên
  status                            String?         @default("pending") @db.VarChar(20)
  gateway_request_id                String?         @db.VarChar(100)
  // ... rest of fields
}
```

**Tìm model `Table` và thêm relation:**

```prisma
model Table {
  id                  String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // ... existing fields
  orders              Order[]
  bill_requests       BillRequest[] // 🆕 THÊM relation
  restaurant          Restaurant    @relation(fields: [restaurant_id], references: [id], onDelete: Cascade)

  @@map("tables")
}
```

**Tìm model `Restaurant` và thêm relation:**

```prisma
model Restaurant {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // ... existing fields
  menu_categories MenuCategory[]
  modifier_groups ModifierGroup[]
  tables          Table[]
  bill_requests   BillRequest[]   // 🆕 THÊM relation

  @@map("restaurants")
}
```

**Tìm model `User` và thêm relation:**

```prisma
model User {
  id                                   String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // ... existing fields
  notifications                        notifications[]
  payments_payments_received_byTousers payments[]      @relation("payments_received_byTousers")
  payments_payments_refunded_byTousers payments[]      @relation("payments_refunded_byTousers")
  restaurants                          Restaurant[]
  user_roles                           UserRole[]
  bill_requests                        BillRequest[]   // 🆕 THÊM relation

  @@map("users")
}
```

**Thêm model `BillRequest` MỚI (ở cuối file, trước enum):**

```prisma
model BillRequest {
  id                  String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  restaurant_id       String      @db.Uuid
  table_id            String      @db.Uuid
  payment_method_code String      @db.VarChar(20)
  subtotal            Decimal     @db.Decimal(12, 2)
  tips_amount         Decimal     @default(0) @db.Decimal(12, 2)
  total_amount        Decimal     @db.Decimal(12, 2)
  order_ids           Json        // Array of order UUIDs
  customer_note       String?
  status              String      @default("pending") @db.VarChar(20)
  accepted_by         String?     @db.Uuid
  accepted_at         DateTime?   @db.Timestamp(6)
  created_at          DateTime    @default(now()) @db.Timestamp(6)
  updated_at          DateTime    @updatedAt @db.Timestamp(6)

  restaurant          Restaurant  @relation(fields: [restaurant_id], references: [id], onDelete: Cascade)
  table               Table       @relation(fields: [table_id], references: [id], onDelete: Cascade)
  waiter              User?       @relation(fields: [accepted_by], references: [id])

  @@index([table_id])
  @@index([status])
  @@index([restaurant_id])
  @@index([restaurant_id, status])
  @@map("bill_requests")
}
```

**Tác dụng:**

- `BillRequest`: Model mới lưu thông tin customer request bill
- `bill_request_id` trong `payments`: Liên kết payment với bill request
- `merged_order_ids`: Backup list các order IDs được gộp
- `tips_amount`: Lưu tiền tips riêng

---

### **Bước 1.2: Tạo Migration**

**Terminal:**

```bash
cd backend

# Tạo migration từ schema changes
npx prisma migrate dev --name add_bill_requests_table

# Nếu có lỗi, xem log và fix
# Output mong đợi: "Migration applied successfully"
```

**Nếu thành công, sẽ tạo file:**
`backend/prisma/migrations/YYYYMMDDHHMMSS_add_bill_requests_table/migration.sql`

**Tác dụng:**

- Tạo bảng `bill_requests` trong database
- Thêm 3 columns mới vào bảng `payments`
- Tạo indexes để query nhanh

---

### **Bước 1.3: Generate Prisma Client**

**Terminal:**

```bash
npx prisma generate
```

**Tác dụng:**

- Update Prisma Client với model mới
- Cho phép code TypeScript dùng `prisma.billRequest`
- Thêm type definitions cho TypeScript

---

### **Bước 1.4: Kiểm tra Migration**

**Terminal:**

```bash
# Xem các bảng trong database
npx prisma studio
```

**Kiểm tra:**

1. Mở Prisma Studio (http://localhost:5555)
2. Kiểm tra bảng `bill_requests` đã xuất hiện
3. Kiểm tra bảng `payments` có 3 columns mới

---

### **✅ CHECKLIST PHASE 1**

```
□ Update schema.prisma - Thêm model BillRequest
□ Update schema.prisma - Thêm 3 fields vào payments
□ Update schema.prisma - Thêm relations vào Table, Restaurant, User
□ Run: npx prisma migrate dev --name add_bill_requests_table
□ Run: npx prisma generate
□ Test: npx prisma studio → Xem bảng bill_requests
□ Commit: git add . && git commit -m "feat(db): add bill_requests table for batch payment"
```

---

## ✅ PHASE 2: BILL REQUESTS MODULE (4h)

### **Bước 2.1: Tạo Module Structure**

**Terminal:**

```bash
cd backend/src

# Tạo module, controller, service
nest g module bill-requests
nest g controller bill-requests --no-spec
nest g service bill-requests --no-spec

# Tạo thư mục DTOs
mkdir -p bill-requests/dto
```

**Files được tạo:**

- `src/bill-requests/bill-requests.module.ts`
- `src/bill-requests/bill-requests.controller.ts`
- `src/bill-requests/bill-requests.service.ts`
- `src/bill-requests/dto/` (folder)

**Tác dụng:**

- Module quản lý tất cả logic bill requests
- Controller xử lý HTTP requests
- Service chứa business logic

---

### **Bước 2.2: Tạo DTOs**

#### **File 1:** `src/bill-requests/dto/create-bill-request.dto.ts`

```typescript
import {
  IsUUID,
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBillRequestDto {
  @ApiProperty({
    description: "ID của bàn",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  table_id: string;

  @ApiProperty({
    description: "Phương thức thanh toán",
    enum: ["momo", "zalopay", "vnpay", "cash"],
    example: "momo",
  })
  @IsString()
  @IsIn(["momo", "zalopay", "vnpay", "cash"])
  payment_method: string;

  @ApiPropertyOptional({
    description: "Tiền tips (VND)",
    default: 0,
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tips_amount?: number = 0;

  @ApiPropertyOptional({
    description: "Ghi chú của khách",
    example: "Cảm ơn nhà hàng!",
  })
  @IsOptional()
  @IsString()
  customer_note?: string;
}
```

**Tác dụng:** Validate request body từ customer khi tạo bill request

---

#### **File 2:** `src/bill-requests/dto/bill-request-response.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BillRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  table_number: string;

  @ApiProperty({ example: 350000 })
  subtotal: number;

  @ApiProperty({ example: 50000 })
  tips_amount: number;

  @ApiProperty({ example: 400000 })
  total_amount: number;

  @ApiProperty({ example: 3 })
  order_count: number;

  @ApiProperty({ example: "momo" })
  payment_method: string;

  @ApiProperty({ enum: ["pending", "accepted", "completed", "cancelled"] })
  status: "pending" | "accepted" | "completed" | "cancelled";

  @ApiPropertyOptional()
  customer_note?: string;

  @ApiProperty()
  created_at: Date;
}

export class AcceptBillRequestResponseDto {
  @ApiProperty()
  bill_request_id: string;

  @ApiProperty()
  payment_id: string;

  @ApiProperty()
  payment_method: string;

  @ApiProperty({ example: 400000 })
  total_amount: number;

  // For online payments (MoMo/ZaloPay/VNPay)
  @ApiPropertyOptional({
    description: "URL của ảnh QR code",
    example: "https://api.vietqr.io/image/...",
  })
  qr_code_url?: string;

  @ApiPropertyOptional({
    description: "Raw QR code data (EMVCo format)",
    example:
      "00020101021238570010A00000072701270006970436011599988800208QRIBFTTA53037045802VN...",
  })
  qr_code_data?: string;

  @ApiPropertyOptional({
    description: "Deep link để mở app",
    example: "momo://app?action=pay&amount=400000",
  })
  pay_url?: string;

  @ApiPropertyOptional()
  expires_at?: Date;

  // For cash payment
  @ApiPropertyOptional({
    description: "True nếu đang chờ waiter confirm cash",
    example: true,
  })
  awaiting_cash_confirmation?: boolean;
}
```

**Tác dụng:** Define response format cho API responses

---

### **Bước 2.3: Implement Service**

**File:** `src/bill-requests/bill-requests.service.ts`

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBillRequestDto } from "./dto/create-bill-request.dto";

@Injectable()
export class BillRequestsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Customer tạo bill request
   * Tác dụng: Gộp tất cả orders chưa thanh toán của bàn → tạo 1 bill request
   */
  async createBillRequest(dto: CreateBillRequestDto, customerId?: string) {
    // 1. Query orders chưa thanh toán (OPTIMIZED)
    const unpaidOrders = await this.prisma.order.findMany({
      where: {
        table_id: dto.table_id,
        status: { in: ["pending", "accepted", "preparing", "ready", "served"] },
      },
      select: {
        id: true,
        order_number: true,
        total: true,
        status: true,
      },
      orderBy: { created_at: "asc" },
    });

    if (unpaidOrders.length === 0) {
      throw new BadRequestException("Không có order nào cần thanh toán");
    }

    // 2. Kiểm tra có bill request pending khác không
    const existingRequest = await this.prisma.billRequest.findFirst({
      where: {
        table_id: dto.table_id,
        status: "pending",
      },
    });

    if (existingRequest) {
      throw new BadRequestException("Đã có yêu cầu thanh toán đang chờ xử lý");
    }

    // 3. Tính tổng tiền
    const subtotal = unpaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
    const tipsAmount = dto.tips_amount || 0;
    const totalAmount = subtotal + tipsAmount;

    // 4. Lấy thông tin table và restaurant
    const table = await this.prisma.table.findUnique({
      where: { id: dto.table_id },
      select: { restaurant_id: true, table_number: true, location: true },
    });

    if (!table) {
      throw new NotFoundException("Bàn không tồn tại");
    }

    // 5. Tạo bill request trong database
    const billRequest = await this.prisma.billRequest.create({
      data: {
        restaurant_id: table.restaurant_id,
        table_id: dto.table_id,
        payment_method_code: dto.payment_method,
        subtotal,
        tips_amount: tipsAmount,
        total_amount: totalAmount,
        order_ids: unpaidOrders.map((o) => o.id), // JSON array
        customer_note: dto.customer_note,
        status: "pending",
      },
    });

    // 6. TODO: Notify waiters qua Socket.IO (Phase 4)

    // 7. Return response
    return {
      id: billRequest.id,
      subtotal,
      tips_amount: tipsAmount,
      total_amount: totalAmount,
      order_count: unpaidOrders.length,
      status: "pending",
      message: "Yêu cầu đã được gửi. Vui lòng chờ waiter xác nhận.",
    };
  }

  /**
   * Waiter lấy danh sách bill requests của restaurant
   */
  async getBillRequestsByRestaurant(restaurantId: string, status?: string) {
    const where: any = { restaurant_id: restaurantId };
    if (status) {
      where.status = status;
    }

    const billRequests = await this.prisma.billRequest.findMany({
      where,
      include: {
        table: {
          select: {
            table_number: true,
            location: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return billRequests.map((br) => ({
      id: br.id,
      table_number: br.table.table_number,
      table_location: br.table.location,
      total_amount: Number(br.total_amount),
      tips_amount: Number(br.tips_amount),
      payment_method: br.payment_method_code,
      order_count: (br.order_ids as string[]).length,
      customer_note: br.customer_note,
      status: br.status,
      created_at: br.created_at,
    }));
  }

  /**
   * Lấy chi tiết 1 bill request
   */
  async getBillRequestById(id: string) {
    const billRequest = await this.prisma.billRequest.findUnique({
      where: { id },
      include: {
        table: {
          select: {
            id: true,
            table_number: true,
            location: true,
          },
        },
        waiter: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request không tồn tại");
    }

    // Lấy chi tiết các orders
    const orderIds = billRequest.order_ids as string[];
    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: orderIds },
      },
      include: {
        order_items: {
          include: {
            menu_item: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    return {
      id: billRequest.id,
      table: billRequest.table,
      orders: orders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        items: o.order_items,
        subtotal: Number(o.total),
      })),
      subtotal: Number(billRequest.subtotal),
      tips_amount: Number(billRequest.tips_amount),
      total_amount: Number(billRequest.total_amount),
      payment_method: billRequest.payment_method_code,
      customer_note: billRequest.customer_note,
      status: billRequest.status,
      waiter: billRequest.waiter,
      created_at: billRequest.created_at,
      accepted_at: billRequest.accepted_at,
    };
  }

  /**
   * Waiter accept bill request
   * TODO: Phase 3 - Integrate với PaymentsService
   */
  async acceptBillRequest(billRequestId: string, waiterId: string) {
    const billRequest = await this.prisma.billRequest.findUnique({
      where: { id: billRequestId },
      include: { table: true },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request không tồn tại");
    }

    if (billRequest.status !== "pending") {
      throw new BadRequestException("Bill request đã được xử lý");
    }

    // Update status
    await this.prisma.billRequest.update({
      where: { id: billRequestId },
      data: {
        status: "accepted",
        accepted_by: waiterId,
        accepted_at: new Date(),
      },
    });

    // TODO: Phase 3 - Call PaymentsService.initiatePaymentFromBillRequest()

    return {
      bill_request_id: billRequestId,
      message: "Bill request đã được chấp nhận",
    };
  }

  /**
   * Cancel/Reject bill request
   */
  async cancelBillRequest(id: string, reason?: string) {
    const billRequest = await this.prisma.billRequest.findUnique({
      where: { id },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request không tồn tại");
    }

    if (billRequest.status !== "pending") {
      throw new BadRequestException("Không thể hủy bill request đã được xử lý");
    }

    await this.prisma.billRequest.update({
      where: { id },
      data: {
        status: "cancelled",
        customer_note: reason
          ? `${billRequest.customer_note}\nLý do hủy: ${reason}`
          : billRequest.customer_note,
      },
    });

    return { message: "Bill request đã bị hủy" };
  }
}
```

**Tác dụng:** Chứa toàn bộ business logic cho bill requests

---

### **Bước 2.4: Implement Controller**

**File:** `src/bill-requests/bill-requests.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BillRequestsService } from "./bill-requests.service";
import { CreateBillRequestDto } from "./dto/create-bill-request.dto";
import {
  BillRequestResponseDto,
  AcceptBillRequestResponseDto,
} from "./dto/bill-request-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Bill Requests")
@Controller("bill-requests")
export class BillRequestsController {
  constructor(private readonly billRequestsService: BillRequestsService) {}

  @Post()
  @ApiOperation({
    summary: "Tạo bill request (Customer)",
    description: 'Customer bấm "Request Bill" để yêu cầu thanh toán',
  })
  @ApiResponse({ status: 201, type: BillRequestResponseDto })
  async create(@Body() dto: CreateBillRequestDto) {
    return this.billRequestsService.createBillRequest(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("waiter", "admin")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Lấy danh sách bill requests (Waiter)",
    description: "Waiter xem tất cả bill requests của restaurant",
  })
  async findAll(@Request() req, @Query("status") status?: string) {
    // TODO: Get restaurant_id from user
    const restaurantId = "xxx"; // Placeholder
    return this.billRequestsService.getBillRequestsByRestaurant(
      restaurantId,
      status
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Xem chi tiết bill request" })
  async findOne(@Param("id") id: string) {
    return this.billRequestsService.getBillRequestById(id);
  }

  @Get(":id/status")
  @ApiOperation({
    summary: "Kiểm tra trạng thái bill request (Customer)",
    description: "Customer polling để xem waiter đã accept chưa",
  })
  async getStatus(@Param("id") id: string) {
    const billRequest = await this.billRequestsService.getBillRequestById(id);
    return {
      id: billRequest.id,
      status: billRequest.status,
      waiter_name: billRequest.waiter?.full_name,
      accepted_at: billRequest.accepted_at,
    };
  }

  @Post(":id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("waiter")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Accept bill request (Waiter)",
    description: "Waiter chấp nhận và tạo payment",
  })
  @ApiResponse({ status: 200, type: AcceptBillRequestResponseDto })
  async accept(@Param("id") id: string, @Request() req) {
    return this.billRequestsService.acceptBillRequest(id, req.user.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hủy bill request" })
  async cancel(@Param("id") id: string, @Body("reason") reason?: string) {
    return this.billRequestsService.cancelBillRequest(id, reason);
  }
}
```

**Tác dụng:** Định nghĩa HTTP endpoints và routing

---

### **Bước 2.5: Update Module**

**File:** `src/bill-requests/bill-requests.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { BillRequestsController } from "./bill-requests.controller";
import { BillRequestsService } from "./bill-requests.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BillRequestsController],
  providers: [BillRequestsService],
  exports: [BillRequestsService], // Export để PaymentsModule dùng
})
export class BillRequestsModule {}
```

---

### **Bước 2.6: Register Module trong AppModule**

**File:** `src/app.module.ts`

```typescript
import { BillRequestsModule } from "./bill-requests/bill-requests.module";

@Module({
  imports: [
    // ... existing modules
    BillRequestsModule, // 🆕 THÊM dòng này
  ],
  // ...
})
export class AppModule {}
```

**Tác dụng:** Đăng ký module với NestJS

---

### **✅ CHECKLIST PHASE 2**

```
□ Run: nest g module bill-requests
□ Run: nest g controller bill-requests --no-spec
□ Run: nest g service bill-requests --no-spec
□ Run: mkdir -p src/bill-requests/dto
□ Create: create-bill-request.dto.ts
□ Create: bill-request-response.dto.ts
□ Implement: bill-requests.service.ts (5 methods)
□ Implement: bill-requests.controller.ts (6 endpoints)
□ Update: bill-requests.module.ts (import PrismaModule)
□ Update: app.module.ts (import BillRequestsModule)
□ Test: npm run start:dev → Không có lỗi
□ Test: GET http://localhost:3000/bill-requests → API hoạt động
□ Commit: git add . && git commit -m "feat(bill-requests): implement bill request module"
```

---

## ⚙️ PHASE 3: PAYMENTS SERVICE - CHI TIẾT IMPLEMENTATION

### **🚨 TÌNH TRẠNG HIỆN TẠI:**

**Các services sau đã TỒN TẠI file nhưng đều EMPTY (chỉ có class declaration):**

| Service             | File                                      | Trạng thái               |
| ------------------- | ----------------------------------------- | ------------------------ |
| **PaymentsService** | `src/payments/payments.service.ts`        | ❌ Empty - Cần implement |
| **MoMoService**     | `src/payments/momo/momo.service.ts`       | ❌ Empty - Cần implement |
| **ZaloPayService**  | `src/payments/zalopay/zalopay.service.ts` | ❌ Empty - Cần implement |
| **VNPayService**    | `src/payments/vnpay/vnpay.service.ts`     | ❌ Empty - Cần implement |
| **CashService**     | `src/payments/cash/cash.service.ts`       | ❌ Empty - Cần implement |

**Module đã được cấu hình đúng:**

- ✅ `payments.module.ts` đã import và provide tất cả 4 gateway services
- ✅ `payments.controller.ts` đã có sẵn
- ✅ Folder structure: `momo/`, `zalopay/`, `vnpay/`, `cash/`

---

### **📋 BƯỚC 3.1: PaymentsService - Core Implementation**

**File:** `src/payments/payments.service.ts`

#### **Thêm imports và constructor:**

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MomoService } from './momo/momo.service';
import { ZaloPayService } from './zalopay/zalopay.service';
import { VnPayService } from './vnpay/vnpay.service';
import { CashService } from './cash/cash.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly momoService: MomoService,
    private readonly zalopayService: ZaloPayService,
    private readonly vnpayService: VnPayService,
    private readonly cashService: CashService,
  ) {}
```

#### **Method 1: `initiatePaymentFromBillRequest()` - TẠO PAYMENT TỪ BILL REQUEST**

```typescript
/**
 * Khởi tạo payment từ bill request (được gọi khi waiter accept)
 */
async initiatePaymentFromBillRequest(dto: {
  bill_request_id: string;
  payment_method: string;
  amount: number;
  tips_amount: number;
  order_ids: string[];
  restaurant_id: string;
}) {
  const { bill_request_id, payment_method, amount, tips_amount, order_ids, restaurant_id } = dto;

  // 1. Validate bill request
  const billRequest = await this.prisma.bill_requests.findUnique({
    where: { id: bill_request_id },
  });

  if (!billRequest) {
    throw new NotFoundException('Bill request not found');
  }

  if (billRequest.status !== 'accepted') {
    throw new BadRequestException('Bill request must be accepted before payment');
  }

  // 2. Lấy payment method từ DB
  const paymentMethod = await this.prisma.payment_methods.findFirst({
    where: {
      name: payment_method,
      restaurant_id: restaurant_id,
      is_active: true,
    },
  });

  if (!paymentMethod) {
    throw new NotFoundException(`Payment method ${payment_method} not found or inactive`);
  }

  // 3. Tạo payment record
  const payment = await this.prisma.payments.create({
    data: {
      bill_request_id,
      payment_method_id: paymentMethod.id,
      amount,
      tips_amount,
      total_amount: amount + tips_amount,
      status: 'pending',
      transaction_id: null, // Sẽ được update khi gateway response
      qr_code: null,
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 phút
    },
  });

  // 4. Gọi gateway service tương ứng
  let gatewayResponse;

  switch (payment_method.toLowerCase()) {
    case 'momo':
      gatewayResponse = await this.momoService.createPayment({
        payment_id: payment.id,
        amount: payment.total_amount,
        order_info: `Payment for ${order_ids.length} orders`,
        restaurant_id,
      });
      break;

    case 'zalopay':
      gatewayResponse = await this.zalopayService.createOrder({
        payment_id: payment.id,
        amount: payment.total_amount,
        description: `Bill payment - ${order_ids.length} orders`,
        restaurant_id,
      });
      break;

    case 'vnpay':
      gatewayResponse = await this.vnpayService.createPaymentUrl({
        payment_id: payment.id,
        amount: payment.total_amount,
        order_info: `Bill ${bill_request_id}`,
        restaurant_id,
      });
      break;

    case 'cash':
      gatewayResponse = await this.cashService.createCashPayment({
        payment_id: payment.id,
        amount: payment.total_amount,
      });
      break;

    default:
      throw new BadRequestException(`Unsupported payment method: ${payment_method}`);
  }

  // 5. Update payment với transaction_id và QR code
  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      transaction_id: gatewayResponse.transaction_id,
      qr_code: gatewayResponse.qr_code || null,
    },
  });

  return {
    payment_id: payment.id,
    transaction_id: gatewayResponse.transaction_id,
    qr_code: gatewayResponse.qr_code,
    payment_url: gatewayResponse.payment_url,
    expires_at: payment.expires_at,
  };
}
```

#### **Method 2: `handleMoMoCallback()` - XỬ LÝ MOMO CALLBACK**

```typescript
async handleMoMoCallback(data: {
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: string;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}) {
  // 1. Verify signature
  const isValid = this.momoService.verifySignature(data);
  if (!isValid) {
    throw new BadRequestException('Invalid MoMo signature');
  }

  // 2. Tìm payment (orderId chính là payment_id)
  const payment = await this.prisma.payments.findUnique({
    where: { id: data.orderId },
    include: { billRequest: true },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  // 3. Update payment status
  const status = data.resultCode === 0 ? 'completed' : 'failed';

  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      status,
      transaction_id: data.transId.toString(),
      paid_at: status === 'completed' ? new Date() : null,
      error_message: status === 'failed' ? data.message : null,
    },
  });

  // 4. Nếu thành công, complete bill
  if (status === 'completed') {
    await this.completeBillPayment(payment.bill_request_id);
  }

  return { status, payment_id: payment.id };
}
```

#### **Method 3: `handleZaloPayCallback()` - XỬ LÝ ZALOPAY CALLBACK**

```typescript
async handleZaloPayCallback(data: {
  app_id: string;
  app_trans_id: string;
  app_time: number;
  app_user: string;
  amount: number;
  embed_data: string;
  item: string;
  zp_trans_id: string;
  server_time: number;
  channel: number;
  merchant_user_id: string;
  user_fee_amount: number;
  discount_amount: number;
  status: number;
  mac: string;
}) {
  // 1. Verify MAC
  const isValid = this.zalopayService.verifyMAC(data);
  if (!isValid) {
    throw new BadRequestException('Invalid ZaloPay MAC');
  }

  // 2. Parse embed_data
  const embedData = JSON.parse(data.embed_data);
  const payment = await this.prisma.payments.findUnique({
    where: { id: embedData.payment_id },
    include: { billRequest: true },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  // 3. Update payment
  const status = data.status === 1 ? 'completed' : 'failed';

  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      status,
      transaction_id: data.zp_trans_id.toString(),
      paid_at: status === 'completed' ? new Date() : null,
    },
  });

  // 4. Complete bill
  if (status === 'completed') {
    await this.completeBillPayment(payment.bill_request_id);
  }

  return { return_code: 1, return_message: 'success' };
}
```

#### **Method 4: `handleVNPayIPN()` - XỬ LÝ VNPAY IPN**

```typescript
async handleVNPayIPN(query: any) {
  // 1. Verify signature
  const isValid = this.vnpayService.verifySignature(query);
  if (!isValid) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  // 2. Lấy payment_id từ vnp_TxnRef
  const payment_id = query.vnp_TxnRef;
  const payment = await this.prisma.payments.findUnique({
    where: { id: payment_id },
    include: { billRequest: true },
  });

  if (!payment) {
    return { RspCode: '01', Message: 'Order not found' };
  }

  // 3. Kiểm tra amount
  const vnp_Amount = parseInt(query.vnp_Amount) / 100;
  if (vnp_Amount !== payment.total_amount) {
    return { RspCode: '04', Message: 'Invalid amount' };
  }

  // 4. Update payment
  const responseCode = query.vnp_ResponseCode;
  const status = responseCode === '00' ? 'completed' : 'failed';

  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      status,
      transaction_id: query.vnp_TransactionNo,
      paid_at: status === 'completed' ? new Date() : null,
      error_message: status === 'failed' ? query.vnp_Message : null,
    },
  });

  // 5. Complete bill
  if (status === 'completed') {
    await this.completeBillPayment(payment.bill_request_id);
  }

  return { RspCode: '00', Message: 'Confirm Success' };
}
```

#### **Method 5: `confirmCashPayment()` - XÁC NHẬN TIỀN MẶT**

```typescript
async confirmCashPayment(dto: {
  payment_id: string;
  received_amount: number;
  waiter_id: string;
}) {
  const { payment_id, received_amount, waiter_id } = dto;

  const payment = await this.prisma.payments.findUnique({
    where: { id: payment_id },
    include: { billRequest: true },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  if (received_amount < payment.total_amount) {
    throw new BadRequestException('Received amount is less than total amount');
  }

  const change = received_amount - payment.total_amount;

  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      status: 'completed',
      paid_at: new Date(),
      transaction_id: `CASH-${Date.now()}`,
    },
  });

  await this.completeBillPayment(payment.bill_request_id);

  return {
    payment_id,
    change_amount: change,
    message: 'Cash payment confirmed',
  };
}
```

#### **Private Helper: `completeBillPayment()`**

```typescript
private async completeBillPayment(bill_request_id: string) {
  const billRequest = await this.prisma.bill_requests.findUnique({
    where: { id: bill_request_id },
    include: { orders: true },
  });

  if (!billRequest) {
    throw new NotFoundException('Bill request not found');
  }

  // Update tất cả orders sang 'paid'
  await this.prisma.order.updateMany({
    where: {
      id: { in: billRequest.orders.map((o) => o.id) },
    },
    data: {
      status: 'paid',
    },
  });

  // Update bill_request sang 'paid'
  await this.prisma.bill_requests.update({
    where: { id: bill_request_id },
    data: {
      status: 'paid',
    },
  });

  // TODO Phase 4: Emit socket event 'bill-paid'

  return { success: true };
}
```

---

### **📋 BƯỚC 3.2: MoMoService - GATEWAY IMPLEMENTATION**

**File:** `src/payments/momo/momo.service.ts`

#### **Environment Variables (.env):**

```env
MOMO_PARTNER_CODE=your_partner_code
MOMO_ACCESS_KEY=your_access_key
MOMO_SECRET_KEY=your_secret_key
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_IPN_URL=https://your-domain.com/api/payments/momo/callback
MOMO_REDIRECT_URL=https://your-frontend.com/payment/result
```

#### **Service Code:**

```typescript
import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import axios from "axios";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MomoService {
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  private readonly ipnUrl: string;
  private readonly redirectUrl: string;

  constructor(private configService: ConfigService) {
    this.partnerCode = this.configService.get<string>("MOMO_PARTNER_CODE");
    this.accessKey = this.configService.get<string>("MOMO_ACCESS_KEY");
    this.secretKey = this.configService.get<string>("MOMO_SECRET_KEY");
    this.endpoint = this.configService.get<string>("MOMO_ENDPOINT");
    this.ipnUrl = this.configService.get<string>("MOMO_IPN_URL");
    this.redirectUrl = this.configService.get<string>("MOMO_REDIRECT_URL");
  }

  private createSignature(rawData: string): string {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(rawData)
      .digest("hex");
  }

  async createPayment(dto: {
    payment_id: string;
    amount: number;
    order_info: string;
    restaurant_id: string;
  }) {
    const { payment_id, amount, order_info } = dto;
    const requestId = `${payment_id}-${Date.now()}`;
    const orderId = payment_id;
    const requestType = "captureWallet";
    const extraData = "";

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${orderId}&orderInfo=${order_info}&partnerCode=${this.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = this.createSignature(rawSignature);

    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo: order_info,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      requestType,
      extraData,
      lang: "vi",
      signature,
    };

    try {
      const response = await axios.post(this.endpoint, requestBody);

      if (response.data.resultCode !== 0) {
        throw new Error(`MoMo error: ${response.data.message}`);
      }

      return {
        transaction_id: response.data.requestId,
        qr_code: response.data.qrCodeUrl || null,
        payment_url: response.data.payUrl,
      };
    } catch (error) {
      throw new Error(`MoMo API error: ${error.message}`);
    }
  }

  verifySignature(data: any): boolean {
    const {
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = data;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${this.partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = this.createSignature(rawSignature);
    return signature === expectedSignature;
  }
}
```

---

### **📋 BƯỚC 3.3: ZaloPayService Implementation**

**File:** `src/payments/zalopay/zalopay.service.ts`

#### **Environment Variables:**

```env
ZALOPAY_APP_ID=your_app_id
ZALOPAY_KEY1=your_key1
ZALOPAY_KEY2=your_key2
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
ZALOPAY_CALLBACK_URL=https://your-domain.com/api/payments/zalopay/callback
```

#### **Service Code:**

```typescript
import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import axios from "axios";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ZaloPayService {
  private readonly appId: string;
  private readonly key1: string;
  private readonly key2: string;
  private readonly endpoint: string;
  private readonly callbackUrl: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>("ZALOPAY_APP_ID");
    this.key1 = this.configService.get<string>("ZALOPAY_KEY1");
    this.key2 = this.configService.get<string>("ZALOPAY_KEY2");
    this.endpoint = this.configService.get<string>("ZALOPAY_ENDPOINT");
    this.callbackUrl = this.configService.get<string>("ZALOPAY_CALLBACK_URL");
  }

  private createMAC(data: string, key: string): string {
    return crypto.createHmac("sha256", key).update(data).digest("hex");
  }

  async createOrder(dto: {
    payment_id: string;
    amount: number;
    description: string;
    restaurant_id: string;
  }) {
    const { payment_id, amount, description } = dto;
    const app_trans_id = `${Date.now()}_${payment_id}`;
    const app_time = Date.now();
    const embed_data = JSON.stringify({ payment_id });

    const order = {
      app_id: this.appId,
      app_user: "customer",
      app_time,
      amount,
      app_trans_id,
      embed_data,
      item: JSON.stringify([{ name: description }]),
      description,
      callback_url: this.callbackUrl,
    };

    const data = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
    const mac = this.createMAC(data, this.key1);

    const requestBody = { ...order, mac };

    try {
      const response = await axios.post(this.endpoint, null, {
        params: requestBody,
      });

      if (response.data.return_code !== 1) {
        throw new Error(`ZaloPay error: ${response.data.return_message}`);
      }

      return {
        transaction_id: app_trans_id,
        payment_url: response.data.order_url,
        qr_code: null,
      };
    } catch (error) {
      throw new Error(`ZaloPay API error: ${error.message}`);
    }
  }

  verifyMAC(data: any): boolean {
    const {
      app_id,
      app_trans_id,
      app_time,
      app_user,
      amount,
      embed_data,
      item,
      mac,
    } = data;
    const rawData = `${app_id}|${app_trans_id}|${app_user}|${amount}|${app_time}|${embed_data}|${item}`;
    const expectedMAC = this.createMAC(rawData, this.key2);
    return mac === expectedMAC;
  }
}
```

---

### **📋 BƯỚC 3.4: VNPayService Implementation**

**File:** `src/payments/vnpay/vnpay.service.ts`

#### **Environment Variables:**

```env
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://your-frontend.com/payment/result
VNPAY_IPN_URL=https://your-domain.com/api/payments/vnpay/ipn
```

#### **Service Code:**

```typescript
import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import * as querystring from "querystring";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class VnPayService {
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly url: string;
  private readonly returnUrl: string;
  private readonly ipnUrl: string;

  constructor(private configService: ConfigService) {
    this.tmnCode = this.configService.get<string>("VNPAY_TMN_CODE");
    this.hashSecret = this.configService.get<string>("VNPAY_HASH_SECRET");
    this.url = this.configService.get<string>("VNPAY_URL");
    this.returnUrl = this.configService.get<string>("VNPAY_RETURN_URL");
    this.ipnUrl = this.configService.get<string>("VNPAY_IPN_URL");
  }

  private createHash(data: string): string {
    return crypto
      .createHmac("sha512", this.hashSecret)
      .update(data)
      .digest("hex");
  }

  private sortObject(obj: any): any {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  createPaymentUrl(dto: {
    payment_id: string;
    amount: number;
    order_info: string;
    restaurant_id: string;
  }) {
    const { payment_id, amount, order_info } = dto;
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(
      new Date(date.getTime() + 15 * 60 * 1000)
    );

    let vnp_Params: any = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: amount * 100,
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: order_info,
      vnp_OrderType: "other",
      vnp_ReturnUrl: this.returnUrl,
      vnp_TxnRef: payment_id,
      vnp_ExpireDate: expireDate,
    };

    vnp_Params = this.sortObject(vnp_Params);
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const secureHash = this.createHash(signData);
    vnp_Params["vnp_SecureHash"] = secureHash;

    const paymentUrl =
      this.url + "?" + querystring.stringify(vnp_Params, { encode: true });

    return {
      transaction_id: payment_id,
      payment_url: paymentUrl,
      qr_code: null,
    };
  }

  verifySignature(query: any): boolean {
    const vnp_SecureHash = query["vnp_SecureHash"];
    delete query["vnp_SecureHash"];
    delete query["vnp_SecureHashType"];

    const sortedParams = this.sortObject(query);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const expectedHash = this.createHash(signData);

    return vnp_SecureHash === expectedHash;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
```

---

### **📋 BƯỚC 3.5: CashService Implementation**

**File:** `src/payments/cash/cash.service.ts`

```typescript
import { Injectable } from "@nestjs/common";

@Injectable()
export class CashService {
  async createCashPayment(dto: { payment_id: string; amount: number }) {
    const { payment_id, amount } = dto;

    return {
      transaction_id: `CASH-${Date.now()}`,
      payment_url: null,
      qr_code: null,
      message: "Please collect cash from customer",
      amount_to_collect: amount,
    };
  }

  calculateChange(received: number, total: number): number {
    if (received < total) {
      throw new Error("Received amount is less than total");
    }
    return received - total;
  }

  suggestChange(changeAmount: number): { [key: string]: number } {
    const denominations = [
      500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000,
    ];
    const result: { [key: string]: number } = {};
    let remaining = changeAmount;

    for (const denom of denominations) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        result[`${denom}đ`] = count;
        remaining -= count * denom;
      }
    }

    return result;
  }
}
```

---

### **✅ CHECKLIST PHASE 3:**

#### **PaymentsService (5 methods):**

- [ ] `initiatePaymentFromBillRequest()` - Tạo payment từ bill request
- [ ] `handleMoMoCallback()` - Xử lý MoMo callback
- [ ] `handleZaloPayCallback()` - Xử lý ZaloPay callback
- [ ] `handleVNPayIPN()` - Xử lý VNPay IPN
- [ ] `confirmCashPayment()` - Xác nhận tiền mặt
- [ ] `completeBillPayment()` - Private helper

#### **Gateway Services:**

- [ ] **MomoService**: `createPayment()`, `verifySignature()`
- [ ] **ZaloPayService**: `createOrder()`, `verifyMAC()`
- [ ] **VNPayService**: `createPaymentUrl()`, `verifySignature()`, `formatDate()`
- [ ] **CashService**: `createCashPayment()`, `calculateChange()`, `suggestChange()`

#### **Configuration:**

- [ ] Thêm 5 environment variables cho MoMo
- [ ] Thêm 5 environment variables cho ZaloPay
- [ ] Thêm 5 environment variables cho VNPay

#### **Integration:**

- [ ] Update `bill-requests.service.ts` để gọi `initiatePaymentFromBillRequest()`
- [ ] Inject `PaymentsService` vào `BillRequestsService`
- [ ] Update `bill-requests.module.ts` imports

---

## ✅ PHASE 3: PAYMENT INTEGRATION (4h)

**[TIẾP TỤC...]**

### **Bước 3.1: Thêm method mới trong PaymentsService**

**File:** `src/payments/payments.service.ts`

Thêm method này vào class `PaymentsService`:

```typescript
/**
 * Tạo payment từ bill request (được gọi khi waiter accept)
 * Tác dụng: Khởi tạo payment và generate QR code cho online payment
 */
async initiatePaymentFromBillRequest(dto: {
  bill_request_id: string;
  payment_method: string;
  amount: number;
  tips_amount: number;
  order_ids: string[];
}) {
  // 1. Lấy payment method từ DB
  const paymentMethod = await this.prisma.payment_methods.findFirst({
    where: { code: dto.payment_method }
  });

  if (!paymentMethod) {
    throw new NotFoundException(`Payment method ${dto.payment_method} không tồn tại`);
  }

  // 2. Tạo payment record
  const payment = await this.prisma.payments.create({
    data: {
      order_id: null, // Null vì batch payment
      payment_method_id: paymentMethod.id,
      bill_request_id: dto.bill_request_id,
      merged_order_ids: dto.order_ids, // JSON array
      amount: dto.amount,
      tips_amount: dto.tips_amount,
      status: 'pending',
    }
  });

  // 3. Generate QR/Payment URL theo method
  if (dto.payment_method === 'cash') {
    return {
      payment_id: payment.id,
      awaiting_cash_confirmation: true,
    };
  }

  // 4. Gọi gateway service để generate QR
  let paymentResult;

  switch (dto.payment_method) {
    case 'momo':
      paymentResult = await this.momoService.createPayment({
        order_id: payment.id,
        amount: dto.amount,
        order_info: `Bill Request - ${dto.order_ids.length} orders`,
      });
      break;

    case 'zalopay':
      paymentResult = await this.zalopayService.createPayment({
        // Similar
      });
      break;

    case 'vnpay':
      paymentResult = await this.vnpayService.createPayment({
        // Similar
      });
      break;
  }

  // 5. Update payment với gateway info
  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      gateway_request_id: paymentResult.request_id,
    }
  });

  return {
    payment_id: payment.id,
    qr_code_url: paymentResult.qr_code_url,
    qr_code_data: paymentResult.qr_code_data,
    pay_url: paymentResult.pay_url,
    expires_at: paymentResult.expires_at,
  };
}
```

---

### **Bước 3.2: Update BillRequestsService để gọi PaymentsService**

**File:** `src/bill-requests/bill-requests.service.ts`

Inject `PaymentsService` và update method `acceptBillRequest`:

```typescript
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class BillRequestsService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService // 🆕 INJECT
  ) {}

  async acceptBillRequest(billRequestId: string, waiterId: string) {
    // ... existing validation code ...

    // Update bill request status
    await this.prisma.billRequest.update({
      where: { id: billRequestId },
      data: {
        status: "accepted",
        accepted_by: waiterId,
        accepted_at: new Date(),
      },
    });

    // 🆕 THÊM: Tạo payment và generate QR
    const paymentResult =
      await this.paymentsService.initiatePaymentFromBillRequest({
        bill_request_id: billRequestId,
        payment_method: billRequest.payment_method_code,
        amount: Number(billRequest.total_amount),
        tips_amount: Number(billRequest.tips_amount),
        order_ids: billRequest.order_ids as string[],
      });

    return {
      bill_request_id: billRequestId,
      payment_id: paymentResult.payment_id,
      payment_method: billRequest.payment_method_code,
      total_amount: Number(billRequest.total_amount),
      ...paymentResult, // QR code, pay_url, etc.
    };
  }
}
```

---

### **Bước 3.3: Update BillRequestsModule**

**File:** `src/bill-requests/bill-requests.module.ts`

```typescript
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    PrismaModule,
    PaymentsModule, // 🆕 THÊM
  ],
  controllers: [BillRequestsController],
  providers: [BillRequestsService],
  exports: [BillRequestsService],
})
export class BillRequestsModule {}
```

---

### **Bước 3.4: Update Payment Callbacks để handle Bill Request**

**File:** `src/payments/payments.service.ts`

Update các callback handlers (MoMo, ZaloPay, VNPay):

```typescript
async handleMoMoCallback(callbackData: any) {
  const payment = await this.prisma.payments.findFirst({
    where: { gateway_request_id: callbackData.requestId }
  });

  if (!payment) {
    throw new NotFoundException('Payment không tồn tại');
  }

  // Update payment status
  await this.prisma.payments.update({
    where: { id: payment.id },
    data: {
      status: callbackData.resultCode === 0 ? 'completed' : 'failed',
      gateway_trans_id: callbackData.transId,
      gateway_response: callbackData,
      completed_at: new Date(),
    }
  });

  if (callbackData.resultCode === 0) {
    // 🆕 THÊM: Handle batch payment
    if (payment.merged_order_ids) {
      // Update tất cả orders thành completed
      const orderIds = payment.merged_order_ids as string[];
      await this.prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: 'completed', completed_at: new Date() }
      });

      // Update bill request status
      if (payment.bill_request_id) {
        await this.prisma.billRequest.update({
          where: { id: payment.bill_request_id },
          data: { status: 'completed' }
        });
      }
    } else {
      // Single order
      await this.prisma.order.update({
        where: { id: payment.order_id },
        data: { status: 'completed', completed_at: new Date() }
      });
    }

    // TODO: Socket.IO notification (Phase 4)
  }

  return { success: true };
}
```

---

### **✅ CHECKLIST PHASE 3**

```
□ Update: payments.service.ts - Add initiatePaymentFromBillRequest()
□ Update: bill-requests.service.ts - Inject PaymentsService
□ Update: bill-requests.service.ts - Call payment trong acceptBillRequest()
□ Update: bill-requests.module.ts - Import PaymentsModule
□ Update: payments.service.ts - Handle merged_order_ids trong callbacks
□ Update: payments.service.ts - Update bill_request status sau payment
□ Test: Tạo bill request → Accept → Check payment created
□ Test: Mock callback → Check orders updated to completed
□ Commit: git add . && git commit -m "feat(payments): integrate with bill requests"
```

---

## ✅ PHASE 4: SOCKET.IO EVENTS (2h)

### **Bước 4.1: Update NotificationsGateway**

**File:** `src/notifications/notifications.gateway.ts`

Thêm methods mới:

```typescript
/**
 * Notify tất cả waiters của restaurant khi có bill request mới
 */
notifyWaiters(restaurantId: string, event: string, data: any) {
  // Lấy tất cả socket connections của waiters thuộc restaurant này
  const waiterSockets = this.getWaiterSocketsByRestaurant(restaurantId);

  waiterSockets.forEach(socket => {
    socket.emit(event, data);
  });
}

/**
 * Notify customer tại bàn cụ thể
 */
notifyTable(tableId: string, event: string, data: any) {
  // Lấy socket connection của customer tại bàn này
  const customerSocket = this.getCustomerSocketByTable(tableId);

  if (customerSocket) {
    customerSocket.emit(event, data);
  }
}

// Helper method để track sockets
private getWaiterSocketsByRestaurant(restaurantId: string) {
  // TODO: Implement socket tracking
  // Có thể dùng Map<restaurantId, Set<socketId>>
  return [];
}

private getCustomerSocketByTable(tableId: string) {
  // TODO: Implement
  return null;
}
```

---

### **Bước 4.2: Update BillRequestsService để emit events**

**File:** `src/bill-requests/bill-requests.service.ts`

```typescript
import { NotificationsGateway } from "../notifications/notifications.gateway";

@Injectable()
export class BillRequestsService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsGateway: NotificationsGateway // 🆕 INJECT
  ) {}

  async createBillRequest(dto: CreateBillRequestDto, customerId?: string) {
    // ... existing code ...

    // 🆕 THÊM: Notify waiters
    this.notificationsGateway.notifyWaiters(
      table.restaurant_id,
      "bill_request:new",
      {
        id: billRequest.id,
        table_number: table.table_number,
        table_location: table.location,
        total_amount: totalAmount,
        tips_amount: tipsAmount,
        payment_method: dto.payment_method,
        order_count: unpaidOrders.length,
        customer_note: dto.customer_note,
        created_at: billRequest.created_at,
      }
    );

    return {
      // ... existing return
    };
  }

  async acceptBillRequest(billRequestId: string, waiterId: string) {
    // ... existing code ...

    // 🆕 THÊM: Notify customer
    const waiter = await this.prisma.user.findUnique({
      where: { id: waiterId },
      select: { full_name: true },
    });

    this.notificationsGateway.notifyTable(
      billRequest.table_id,
      "bill_request:accepted",
      {
        bill_request_id: billRequestId,
        waiter_name: waiter.full_name,
        message: "Waiter đang xử lý thanh toán của bạn",
      }
    );

    return {
      // ... existing return
    };
  }
}
```

---

### **Bước 4.3: Update PaymentsService để emit payment completed**

**File:** `src/payments/payments.service.ts`

```typescript
async handleMoMoCallback(callbackData: any) {
  // ... existing code ...

  if (callbackData.resultCode === 0) {
    // ... update orders & bill request ...

    // 🆕 THÊM: Notify payment completed
    if (payment.bill_request_id) {
      const billRequest = await this.prisma.billRequest.findUnique({
        where: { id: payment.bill_request_id },
        include: { table: true }
      });

      // Notify customer
      this.notificationsGateway.notifyTable(
        billRequest.table_id,
        'payment:completed',
        {
          bill_request_id: payment.bill_request_id,
          payment_id: payment.id,
          total_amount: Number(payment.amount),
          payment_method: callbackData.paymentType,
          message: 'Thanh toán thành công! Cảm ơn quý khách.',
        }
      );

      // Notify admin/waiters
      this.notificationsGateway.notifyWaiters(
        billRequest.restaurant_id,
        'payment:received',
        {
          table_number: billRequest.table.table_number,
          amount: Number(payment.amount),
          tips: Number(payment.tips_amount),
          method: 'MoMo',
          bill_request_id: payment.bill_request_id,
        }
      );
    }
  }

  return { success: true };
}
```

---

### **✅ CHECKLIST PHASE 4**

```
□ Update: notifications.gateway.ts - Add notifyWaiters()
□ Update: notifications.gateway.ts - Add notifyTable()
□ Update: bill-requests.service.ts - Inject NotificationsGateway
□ Update: bill-requests.service.ts - Emit 'bill_request:new' sau tạo
□ Update: bill-requests.service.ts - Emit 'bill_request:accepted' sau accept
□ Update: payments.service.ts - Emit 'payment:completed' trong callback
□ Test: Socket.IO test tool → Listen events
□ Test: Tạo bill request → Waiter nhận notification
□ Commit: git add . && git commit -m "feat(socket): add bill request events"
```

---

## ✅ PHASE 5 & 6: GATEWAY SERVICES & TESTING (6h)

**[Chi tiết tương tự, viết đầy đủ nếu cần]**

---

## 📊 PERFORMANCE NOTES

### **Query tối ưu - QUAN TRỌNG!**

```typescript
// ❌ SAI - Chậm với dữ liệu lớn
const allOrders = await prisma.order.findMany({
  where: { table_id: tableId },
});
const unpaidOrders = allOrders.filter((o) => o.status !== "completed");

// ✅ ĐÚNG - Lọc tại database
const unpaidOrders = await prisma.order.findMany({
  where: {
    table_id: tableId,
    status: { in: ["pending", "accepted", "preparing", "ready", "served"] },
  },
});
```

### **Indexes cần thiết:**

```sql
-- Đã có sẵn trong schema
```

---

## ✅ MASTER CHECKLIST - TASK 3.1

### **Phase 1: Database (1h)**
- [ ] Update `schema.prisma` với BillRequest model
- [ ] Chạy `npx prisma migrate dev --name add_bill_requests`
- [ ] Chạy `npx prisma generate`
- [ ] Verify trong Prisma Studio
- [ ] **Commit:** `git commit -m "feat(database): add bill_requests migration"`

### **Phase 2: Bill Requests Module (3h)**
- [x] Tạo `bill-requests.module.ts`
- [x] Tạo `bill-requests.controller.ts` với 6 endpoints
- [x] Tạo `bill-requests.service.ts` với 5 methods
- [x] Tạo DTOs: `create-bill-request.dto.ts`, `bill-request-response.dto.ts`
- [ ] **Commit:** `git commit -m "feat(bill-request): implement service and controller"`

### **Phase 3: Gateway Services (6h)**
- [ ] Thêm env variables cho MoMo (6 vars)
- [ ] Thêm env variables cho ZaloPay (5 vars)
- [ ] Thêm env variables cho VNPay (5 vars)
- [ ] Implement `MomoService`: `createPayment()`, `verifySignature()`
- [ ] Implement `ZalopayService`: `createOrder()`, `verifyMAC()`
- [ ] Implement `VnpayService`: `createPaymentUrl()`, `verifySignature()`
- [ ] Implement `CashService`: `createCashPayment()`, `calculateChange()`
- [ ] **Commit:** `git commit -m "feat(payment): implement 4 gateway services"`

### **Phase 3: PaymentsService (3h)**
- [ ] Implement `initiatePaymentFromBillRequest()`
- [ ] Implement `handleMoMoCallback()`
- [ ] Implement `handleZaloPayCallback()`
- [ ] Implement `handleVNPayIPN()`
- [ ] Implement `confirmCashPayment()`
- [ ] Implement `completeBillPayment()` helper
- [ ] Update `bill-requests.service.ts` để inject và gọi PaymentsService
- [ ] **Commit:** `git commit -m "feat(payment): implement PaymentsService core"`

### **Phase 4: Socket.IO Events (2h)**
- [ ] Add `notifyWaiters()` method
- [ ] Add `notifyTable()` method
- [ ] Emit `bill_request:new` khi tạo
- [ ] Emit `bill_request:accepted` khi accept
- [ ] Emit `payment:completed` trong callbacks
- [ ] Test với Socket.IO test tool
- [ ] **Commit:** `git commit -m "feat(socket): add bill request events"`

### **Phase 5: Testing (2h)**
- [ ] Unit tests cho MomoService
- [ ] Unit tests cho PaymentsService
- [ ] Integration test: Bill request flow
- [ ] **Commit:** `git commit -m "test(payment): add unit tests"`

### **Phase 6: Documentation (1h)**
- [ ] Update `.env.example` với tất cả payment vars
- [ ] Update README nếu cần
- [ ] **Commit:** `git commit -m "docs(payment): update environment variables"`

### **Merge:**
```bash
git push origin feature/sprint3-task-3.1-batch-payment
# Create PR on GitHub/GitLab
# Request review
# Merge to develop
```

---

## 🎯 NEXT TASK

Sau khi hoàn thành Task 3.1, tiếp tục với:

**→ [SPRINT3_TASK_3.2_PAYMENT_RECORDS_V2.md](./SPRINT3_TASK_3.2_PAYMENT_RECORDS_V2.md)** - Refund Logic
CREATE INDEX idx_orders_table_status ON orders(table_id, status);

-- Thêm cho bill_requests
CREATE INDEX idx_bill_requests_table_status ON bill_requests(table_id, status);
CREATE INDEX idx_bill_requests_restaurant_status ON bill_requests(restaurant_id, status);
```

### **Performance với 1 triệu orders:**

| Query                       | Không Index | Có Index |
| --------------------------- | ----------- | -------- |
| Lấy unpaid orders của 1 bàn | ~500ms      | ~2ms     |
| Lấy pending bill requests   | ~300ms      | ~1ms     |

---

## 🚀 SUMMARY

**Thay đổi chính:**

1. **Thêm module `bill-requests`** - Quản lý yêu cầu thanh toán
2. **Flow mới:** Customer request → Waiter accept → Payment
3. **Batch payment:** Gộp nhiều orders → 1 payment
4. **Tips support:** Customer có thể thêm tiền boa
5. **QR on Waiter screen:** Waiter show QR cho customer scan

**Thời gian estimate:** 16-18 giờ (tăng 2h so với phiên bản cũ)
