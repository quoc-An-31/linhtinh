# 🚀 SPRINT 2 IMPLEMENTATION GUIDE - SMART RESTAURANT

> **Sprint 2: CORE ORDERING FLOW (Tuần 3-4)**  
> **Mục tiêu:** Implement complete ordering flow: Customer → Waiter → Kitchen với real-time updates  
> **Dựa trên:** Sprint 1 đã hoàn thành (Auth system, Order schema, Basic APIs)

---

## 📦 DEPENDENCIES & LIBRARIES CẦN CÀI ĐẶT

### Backend Dependencies

```bash
# WebSocket & Real-time
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Utilities for reports
npm install exceljs csv-writer date-fns

# Email notifications (optional)
npm install @nestjs-modules/mailer nodemailer handlebars
```

### Frontend Dependencies

```bash
# Socket.IO client
npm install socket.io-client

# Charts for reports
npm install recharts

# Date handling
npm install date-fns

# React icons (if not installed)
npm install react-icons

# Loading & notifications
npm install react-hot-toast react-loading-skeleton
```

---

# 🔵 MEMBER 1 (HẢI): NOTIFICATIONS & REAL-TIME SYSTEM

---

## 📋 TASK 2.1: SETUP SOCKET.IO (6 giờ)

### **Mục đích:**

Thiết lập WebSocket server để hỗ trợ real-time communication giữa Customer, Waiter, và Kitchen.

### **Implementation Steps:**

#### **Bước 1: Cài đặt dependencies**

```bash
cd backend
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

#### **Bước 2: Tạo Notifications Gateway**

Tạo file: `backend/src/notifications/notifications.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
  namespace: "/notifications",
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients = new Map<
    string,
    { userId: string; roles: string[] }
  >();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Extract JWT token from handshake auth
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      this.connectedClients.set(client.id, {
        userId: payload.sub,
        roles: payload.roles || [],
      });

      // Join user-specific room
      client.join(`user:${payload.sub}`);

      // Join role-based rooms
      if (payload.roles) {
        payload.roles.forEach((role: string) => {
          client.join(`role:${role}`);
        });
      }

      this.logger.log(
        `Client connected: ${client.id} | User: ${
          payload.sub
        } | Roles: ${payload.roles?.join(", ")}`
      );
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    this.logger.log(
      `Client disconnected: ${client.id} | User: ${clientInfo?.userId}`
    );
    this.connectedClients.delete(client.id);
  }

  // Emit notification to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit notification to specific role (waiter, kitchen, admin)
  emitToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data);
  }

  // Emit to all clients
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // Subscribe to test connection
  @SubscribeMessage("ping")
  handlePing(@ConnectedSocket() client: Socket): string {
    return "pong";
  }
}
```

**Giải thích:**

- `@WebSocketGateway`: Decorator tạo WebSocket server
- `handleConnection`: Verify JWT token khi client kết nối
- Sử dụng **rooms** để gửi notification cho specific users/roles
- `emitToUser`, `emitToRole`: Helper methods để emit events

#### **Bước 3: Tạo Notifications Module**

Tạo file: `backend/src/notifications/notifications.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
```

#### **Bước 4: Tạo Notifications Service (để lưu lịch sử)**

Tạo file: `backend/src/notifications/notifications.service.ts`

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        is_read: false,
      },
    });
  }

  async getUserNotifications(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
      data: { is_read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });
  }
}
```

#### **Bước 5: Thêm Notifications schema vào Prisma**

Cập nhật file: `backend/prisma/schema.prisma`

```prisma
model Notification {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String   @db.Uuid
  type       String   @db.VarChar(50) // 'new_order', 'order_accepted', 'order_ready', 'order_served'
  title      String   @db.VarChar(255)
  message    String   @db.Text
  data       Json?    // Additional data (order_id, table_id, etc.)
  is_read    Boolean  @default(false)
  created_at DateTime @default(now()) @db.Timestamp(6)

  @@index([user_id])
  @@index([is_read])
  @@index([created_at])
  @@map("notifications")
}
```

**Chạy migration:**

```bash
cd backend
npx prisma migrate dev --name add_notifications_table
npx prisma generate
```

#### **Bước 6: Import NotificationsModule vào AppModule**

Cập nhật file: `backend/src/app.module.ts`

```typescript
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    // ... existing imports
    NotificationsModule,
  ],
  // ...
})
export class AppModule {}
```

#### **Bước 7: Test WebSocket connection**

Tạo file test: `backend/src/notifications/test-socket.html` (optional)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Test</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  </head>
  <body>
    <h1>WebSocket Connection Test</h1>
    <div id="status">Connecting...</div>
    <div id="messages"></div>

    <script>
      const token = "YOUR_JWT_TOKEN_HERE"; // Replace with actual token

      const socket = io("http://localhost:3000/notifications", {
        auth: { token },
      });

      socket.on("connect", () => {
        document.getElementById("status").innerHTML =
          "✅ Connected: " + socket.id;

        // Test ping
        socket.emit("ping", (response) => {
          console.log("Ping response:", response);
        });
      });

      socket.on("disconnect", () => {
        document.getElementById("status").innerHTML = "❌ Disconnected";
      });

      socket.on("new_order", (data) => {
        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML +=
          "<p>📦 New Order: " + JSON.stringify(data) + "</p>";
      });

      socket.on("order_accepted", (data) => {
        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML +=
          "<p>✅ Order Accepted: " + JSON.stringify(data) + "</p>";
      });
    </script>
  </body>
</html>
```

### ✅ **Task 2.1 Checklist:**

- [ ] Đã cài đặt `@nestjs/websockets` và `socket.io`
- [ ] Tạo `NotificationsGateway` với JWT authentication
- [ ] Tạo `NotificationsService` để lưu lịch sử notifications
- [ ] Thêm `Notification` model vào Prisma schema
- [ ] Chạy migration thành công
- [ ] Import `NotificationsModule` vào `AppModule`
- [ ] Test WebSocket connection thành công (client có thể connect)
- [ ] Verify JWT authentication hoạt động (reject clients không có token)
- [ ] Test ping/pong message
- [ ] Kiểm tra server logs hiển thị client connections/disconnections

---

## 📋 TASK 2.2: REAL-TIME ORDER NOTIFICATIONS (10 giờ)

### **Mục đích:**

Emit real-time events khi order status thay đổi để Customer, Waiter, và Kitchen nhận thông báo ngay lập tức.

### **Implementation Steps:**

#### **Bước 1: Enhance NotificationsGateway với order events**

Cập nhật file: `backend/src/notifications/notifications.gateway.ts`

```typescript
// Add new methods to NotificationsGateway class:

/**
 * Notify waiters about new order
 */
async notifyNewOrder(order: any) {
  const notification = {
    type: 'new_order',
    title: 'New Order Received',
    message: `New order #${order.order_number} from Table ${order.table.table_number}`,
    data: {
      order_id: order.id,
      order_number: order.order_number,
      table_number: order.table.table_number,
      total: order.total,
      items_count: order.order_items.length,
    },
    timestamp: new Date().toISOString(),
  };

  // Emit to all waiters
  this.emitToRole('waiter', 'new_order', notification);

  // Also emit to admins
  this.emitToRole('admin', 'new_order', notification);

  this.logger.log(`Notified waiters: New order ${order.order_number}`);
}

/**
 * Notify kitchen when order is accepted
 */
async notifyOrderAccepted(order: any) {
  const notification = {
    type: 'order_accepted',
    title: 'Order Accepted',
    message: `Order #${order.order_number} accepted - Start preparing`,
    data: {
      order_id: order.id,
      order_number: order.order_number,
      table_number: order.table.table_number,
      items: order.order_items.map((item: any) => ({
        name: item.menu_item.name,
        quantity: item.quantity,
        modifiers: item.modifiers || [],
      })),
    },
    timestamp: new Date().toISOString(),
  };

  // Emit to kitchen staff
  this.emitToRole('kitchen', 'order_accepted', notification);

  // Notify customer
  if (order.customer_id) {
    this.emitToUser(order.customer_id, 'order_status_update', {
      order_id: order.id,
      status: 'accepted',
      message: 'Your order has been accepted',
    });
  }

  this.logger.log(`Notified kitchen: Order ${order.order_number} accepted`);
}

/**
 * Notify waiter when order is ready
 */
async notifyOrderReady(order: any) {
  const notification = {
    type: 'order_ready',
    title: 'Order Ready',
    message: `Order #${order.order_number} is ready to serve`,
    data: {
      order_id: order.id,
      order_number: order.order_number,
      table_number: order.table.table_number,
      prep_time_minutes: order.prep_time_minutes || 0,
    },
    timestamp: new Date().toISOString(),
  };

  // Emit to waiters
  this.emitToRole('waiter', 'order_ready', notification);

  // Notify customer
  if (order.customer_id) {
    this.emitToUser(order.customer_id, 'order_status_update', {
      order_id: order.id,
      status: 'ready',
      message: 'Your order is ready',
    });
  }

  this.logger.log(`Notified waiter: Order ${order.order_number} ready`);
}

/**
 * Notify customer when order is served
 */
async notifyOrderServed(order: any) {
  if (order.customer_id) {
    this.emitToUser(order.customer_id, 'order_status_update', {
      order_id: order.id,
      status: 'served',
      message: 'Your order has been served. Enjoy your meal!',
      timestamp: new Date().toISOString(),
    });
  }

  this.logger.log(`Notified customer: Order ${order.order_number} served`);
}

/**
 * Notify about order rejection
 */
async notifyOrderRejected(order: any, reason: string) {
  const notification = {
    type: 'order_rejected',
    title: 'Order Rejected',
    message: `Order #${order.order_number} was rejected`,
    data: {
      order_id: order.id,
      order_number: order.order_number,
      reason,
    },
    timestamp: new Date().toISOString(),
  };

  // Notify customer
  if (order.customer_id) {
    this.emitToUser(order.customer_id, 'order_rejected', notification);
  }

  // Notify admins
  this.emitToRole('admin', 'order_rejected', notification);

  this.logger.log(`Notified: Order ${order.order_number} rejected`);
}
```

#### **Bước 2: Integrate với OrdersService**

Cập nhật file: `backend/src/orders/orders.service.ts`

Inject `NotificationsGateway` và `NotificationsService`:

```typescript
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    private notificationsService: NotificationsService
  ) {}

  // ... existing methods

  /**
   * Update in create() method - after order created
   */
  async create(createDto: CreateOrderDto) {
    // ... existing order creation logic

    const createdOrder = await this.prisma.order.create({
      data: orderData,
      include: {
        table: true,
        order_items: {
          include: {
            menu_item: true,
            modifiers: {
              include: {
                modifier_option: true,
              },
            },
          },
        },
      },
    });

    // 🔔 Emit real-time notification to waiters
    await this.notificationsGateway.notifyNewOrder(createdOrder);

    // Save notification to database (for waiters)
    const waiters = await this.prisma.user.findMany({
      where: {
        user_roles: {
          some: {
            role: { name: "waiter" },
          },
        },
        status: "active",
      },
    });

    for (const waiter of waiters) {
      await this.notificationsService.createNotification({
        user_id: waiter.id,
        type: "new_order",
        title: "New Order",
        message: `Order #${createdOrder.order_number} from Table ${createdOrder.table.table_number}`,
        data: { order_id: createdOrder.id },
      });
    }

    return createdOrder;
  }

  /**
   * Update order status and emit notifications
   */
  async updateStatus(orderId: string, statusDto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        order_items: {
          include: {
            menu_item: true,
            modifiers: {
              include: {
                modifier_option: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate status transition
    this.validateStatusTransition(order.status, statusDto.status);

    // Update order with timestamp
    const updateData: any = {
      status: statusDto.status,
    };

    // Set timestamps based on status
    switch (statusDto.status) {
      case OrderStatus.accepted:
        updateData.accepted_at = new Date();
        break;
      case OrderStatus.preparing:
        updateData.preparing_at = new Date();
        break;
      case OrderStatus.ready:
        updateData.ready_at = new Date();
        break;
      case OrderStatus.served:
        updateData.served_at = new Date();
        break;
      case OrderStatus.completed:
        updateData.completed_at = new Date();
        break;
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        table: true,
        order_items: {
          include: {
            menu_item: true,
            modifiers: {
              include: {
                modifier_option: true,
              },
            },
          },
        },
      },
    });

    // 🔔 Emit real-time notifications based on status
    switch (statusDto.status) {
      case OrderStatus.accepted:
        await this.notificationsGateway.notifyOrderAccepted(updatedOrder);
        break;
      case OrderStatus.ready:
        await this.notificationsGateway.notifyOrderReady(updatedOrder);
        break;
      case OrderStatus.served:
        await this.notificationsGateway.notifyOrderServed(updatedOrder);
        break;
      case OrderStatus.rejected:
        await this.notificationsGateway.notifyOrderRejected(
          updatedOrder,
          statusDto.rejection_reason || "No reason provided"
        );
        break;
    }

    return updatedOrder;
  }

  /**
   * Validate status transition (prevent invalid state changes)
   */
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ) {
    const validTransitions = {
      [OrderStatus.pending]: [OrderStatus.accepted, OrderStatus.rejected],
      [OrderStatus.accepted]: [OrderStatus.preparing, OrderStatus.cancelled],
      [OrderStatus.preparing]: [OrderStatus.ready, OrderStatus.cancelled],
      [OrderStatus.ready]: [OrderStatus.served, OrderStatus.cancelled],
      [OrderStatus.served]: [OrderStatus.completed],
      [OrderStatus.completed]: [],
      [OrderStatus.cancelled]: [],
      [OrderStatus.rejected]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
```

#### **Bước 3: Update OrdersModule để inject NotificationsModule**

Cập nhật file: `backend/src/orders/orders.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

### ✅ **Task 2.2 Checklist:**

- [ ] Thêm order notification methods vào `NotificationsGateway`
- [ ] Inject `NotificationsGateway` vào `OrdersService`
- [ ] Emit `new_order` event khi order được tạo
- [ ] Emit `order_accepted` event khi waiter accept
- [ ] Emit `order_ready` event khi kitchen hoàn thành
- [ ] Emit `order_served` event khi waiter serve
- [ ] Emit `order_rejected` event khi order bị reject
- [ ] Implement status transition validation
- [ ] Save notifications to database
- [ ] Test với multiple clients (waiter, kitchen, customer)
- [ ] Verify notifications đến đúng role (waiter nhận new_order, kitchen nhận order_accepted)
- [ ] Test với browser console/Postman để verify events

---

## 📋 TASK 2.3: NOTIFICATION HISTORY API (6 giờ)

### **Mục đích:**

Tạo APIs để user có thể xem lịch sử notifications, mark as read, và delete.

### **Implementation Steps:**

#### **Bước 1: Tạo Notifications Controller**

Tạo file: `backend/src/notifications/notifications.controller.ts`

```typescript
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * Get user's notifications (with pagination)
   */
  @Get()
  async getUserNotifications(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const userId = req.user.sub;
    const notifications = await this.notificationsService.getUserNotifications(
      userId,
      parseInt(limit) || 20,
      parseInt(offset) || 0
    );

    const unreadCount = await this.notificationsService.getUnreadCount(userId);

    return {
      notifications,
      unread_count: unreadCount,
      total: notifications.length,
    };
  }

  /**
   * Get unread count
   */
  @Get("unread-count")
  async getUnreadCount(@Request() req) {
    const userId = req.user.sub;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unread_count: count };
  }

  /**
   * Mark notification as read
   */
  @Patch(":id/read")
  async markAsRead(@Param("id") id: string, @Request() req) {
    const userId = req.user.sub;
    await this.notificationsService.markAsRead(id, userId);
    return { success: true, message: "Notification marked as read" };
  }

  /**
   * Mark all notifications as read
   */
  @Patch("read-all")
  async markAllAsRead(@Request() req) {
    const userId = req.user.sub;
    await this.notificationsService.markAllAsRead(userId);
    return { success: true, message: "All notifications marked as read" };
  }

  /**
   * Delete notification
   */
  @Delete(":id")
  async deleteNotification(@Param("id") id: string, @Request() req) {
    const userId = req.user.sub;
    await this.notificationsService.deleteNotification(id, userId);
    return { success: true, message: "Notification deleted" };
  }
}
```

#### **Bước 2: Update NotificationsService với pagination**

Cập nhật file: `backend/src/notifications/notifications.service.ts`

```typescript
async getUserNotifications(userId: string, limit = 20, offset = 0) {
  return this.prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });
}
```

#### **Bước 3: Export controller trong NotificationsModule**

Cập nhật file: `backend/src/notifications/notifications.module.ts`

```typescript
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  providers: [NotificationsGateway, NotificationsService],
  controllers: [NotificationsController], // Add this
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
```

### ✅ **Task 2.3 Checklist:**

- [ ] Tạo `NotificationsController` với các endpoints
- [ ] Implement `GET /notifications` (list user notifications)
- [ ] Implement `GET /notifications/unread-count`
- [ ] Implement `PATCH /notifications/:id/read`
- [ ] Implement `PATCH /notifications/read-all`
- [ ] Implement `DELETE /notifications/:id`
- [ ] Test với Postman/Thunder Client
- [ ] Verify pagination hoạt động
- [ ] Test với JWT authentication
- [ ] Kiểm tra user chỉ có thể xem/sửa notifications của mình

---

## 📋 TASK 2.4: ANALYTICS & REPORTS BACKEND (12 giờ)

### **Mục đích:**

Tạo APIs để hiển thị báo cáo doanh thu, món ăn phổ biến, thống kê orders theo status.

### **Implementation Steps:**

#### **Bước 1: Cài đặt dependencies cho export**

```bash
cd backend
npm install exceljs date-fns
```

#### **Bước 2: Tạo Reports Service**

Tạo file: `backend/src/reports/reports.service.ts`

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { OrderStatus } from "@prisma/client";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get daily revenue for date range
   */
  async getDailyRevenue(restaurantId: string, startDate: Date, endDate: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        status: {
          in: [OrderStatus.completed],
        },
        created_at: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
      select: {
        created_at: true,
        total: true,
        subtotal: true,
        tax: true,
      },
    });

    // Group by date
    const revenueByDate = orders.reduce((acc, order) => {
      const date = format(order.created_at, "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = {
          date,
          total_revenue: 0,
          total_orders: 0,
          subtotal: 0,
          tax: 0,
        };
      }
      acc[date].total_revenue += Number(order.total);
      acc[date].subtotal += Number(order.subtotal);
      acc[date].tax += Number(order.tax);
      acc[date].total_orders += 1;
      return acc;
    }, {});

    return Object.values(revenueByDate).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );
  }

  /**
   * Get popular items (top-selling)
   */
  async getPopularItems(restaurantId: string, limit = 10, days = 30) {
    const startDate = subDays(new Date(), days);

    const popularItems = await this.prisma.orderItem.groupBy({
      by: ["menu_item_id"],
      where: {
        order: {
          restaurant_id: restaurantId,
          status: {
            in: [OrderStatus.completed, OrderStatus.served],
          },
          created_at: {
            gte: startDate,
          },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: limit,
    });

    // Fetch menu item details
    const itemsWithDetails = await Promise.all(
      popularItems.map(async (item) => {
        const menuItem = await this.prisma.menuItem.findUnique({
          where: { id: item.menu_item_id },
          select: {
            id: true,
            name: true,
            price: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        return {
          menu_item_id: item.menu_item_id,
          name: menuItem?.name,
          category: menuItem?.category.name,
          total_quantity: item._sum.quantity,
          total_revenue: item._sum.subtotal,
          times_ordered: item._count.id,
        };
      })
    );

    return itemsWithDetails;
  }

  /**
   * Get orders grouped by status
   */
  async getOrdersByStatus(
    restaurantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const whereClause: any = {
      restaurant_id: restaurantId,
    };

    if (startDate && endDate) {
      whereClause.created_at = {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      };
    }

    const ordersByStatus = await this.prisma.order.groupBy({
      by: ["status"],
      where: whereClause,
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
    });

    return ordersByStatus.map((item) => ({
      status: item.status,
      count: item._count.id,
      total_revenue: item._sum.total || 0,
    }));
  }

  /**
   * Get average preparation time
   */
  async getAveragePrepTime(restaurantId: string, days = 7) {
    const startDate = subDays(new Date(), days);

    const completedOrders = await this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        status: {
          in: [OrderStatus.completed, OrderStatus.served],
        },
        created_at: {
          gte: startDate,
        },
        accepted_at: { not: null },
        ready_at: { not: null },
      },
      select: {
        accepted_at: true,
        ready_at: true,
      },
    });

    if (completedOrders.length === 0) {
      return { average_prep_time_minutes: 0, orders_analyzed: 0 };
    }

    const totalPrepTime = completedOrders.reduce((sum, order) => {
      if (order.accepted_at && order.ready_at) {
        const prepTime =
          (order.ready_at.getTime() - order.accepted_at.getTime()) / 1000 / 60;
        return sum + prepTime;
      }
      return sum;
    }, 0);

    return {
      average_prep_time_minutes: Math.round(
        totalPrepTime / completedOrders.length
      ),
      orders_analyzed: completedOrders.length,
    };
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(restaurantId: string) {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Today's revenue
    const todayOrders = await this.prisma.order.aggregate({
      where: {
        restaurant_id: restaurantId,
        status: OrderStatus.completed,
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    // Pending orders count
    const pendingOrders = await this.prisma.order.count({
      where: {
        restaurant_id: restaurantId,
        status: OrderStatus.pending,
      },
    });

    // Orders in preparation
    const preparingOrders = await this.prisma.order.count({
      where: {
        restaurant_id: restaurantId,
        status: {
          in: [OrderStatus.accepted, OrderStatus.preparing],
        },
      },
    });

    // Ready to serve
    const readyOrders = await this.prisma.order.count({
      where: {
        restaurant_id: restaurantId,
        status: OrderStatus.ready,
      },
    });

    return {
      today_revenue: todayOrders._sum.total || 0,
      today_orders_count: todayOrders._count.id,
      pending_orders: pendingOrders,
      preparing_orders: preparingOrders,
      ready_orders: readyOrders,
    };
  }
}
```

#### **Bước 3: Tạo Reports Controller**

Tạo file: `backend/src/reports/reports.controller.ts`

```typescript
import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "super_admin")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * GET /reports/daily-revenue?restaurant_id=xxx&start_date=2026-01-01&end_date=2026-01-31
   */
  @Get("daily-revenue")
  async getDailyRevenue(
    @Query("restaurant_id") restaurantId: string,
    @Query("start_date") startDate: string,
    @Query("end_date") endDate: string
  ) {
    if (!restaurantId || !startDate || !endDate) {
      throw new BadRequestException("Missing required parameters");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.reportsService.getDailyRevenue(restaurantId, start, end);
  }

  /**
   * GET /reports/popular-items?restaurant_id=xxx&limit=10&days=30
   */
  @Get("popular-items")
  async getPopularItems(
    @Query("restaurant_id") restaurantId: string,
    @Query("limit") limit?: string,
    @Query("days") days?: string
  ) {
    if (!restaurantId) {
      throw new BadRequestException("restaurant_id is required");
    }

    return this.reportsService.getPopularItems(
      restaurantId,
      parseInt(limit) || 10,
      parseInt(days) || 30
    );
  }

  /**
   * GET /reports/orders-by-status?restaurant_id=xxx
   */
  @Get("orders-by-status")
  async getOrdersByStatus(
    @Query("restaurant_id") restaurantId: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string
  ) {
    if (!restaurantId) {
      throw new BadRequestException("restaurant_id is required");
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.reportsService.getOrdersByStatus(restaurantId, start, end);
  }

  /**
   * GET /reports/average-prep-time?restaurant_id=xxx&days=7
   */
  @Get("average-prep-time")
  async getAveragePrepTime(
    @Query("restaurant_id") restaurantId: string,
    @Query("days") days?: string
  ) {
    if (!restaurantId) {
      throw new BadRequestException("restaurant_id is required");
    }

    return this.reportsService.getAveragePrepTime(
      restaurantId,
      parseInt(days) || 7
    );
  }

  /**
   * GET /reports/dashboard-summary?restaurant_id=xxx
   */
  @Get("dashboard-summary")
  async getDashboardSummary(@Query("restaurant_id") restaurantId: string) {
    if (!restaurantId) {
      throw new BadRequestException("restaurant_id is required");
    }

    return this.reportsService.getDashboardSummary(restaurantId);
  }
}
```

#### **Bước 4: Tạo Reports Module**

Tạo file: `backend/src/reports/reports.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
```

#### **Bước 5: Import ReportsModule vào AppModule**

```typescript
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    // ... existing imports
    ReportsModule,
  ],
})
export class AppModule {}
```

### ✅ **Task 2.4 Checklist:**

- [ ] Cài đặt `exceljs` và `date-fns`
- [ ] Tạo `ReportsService` với các analytics methods
- [ ] Implement `getDailyRevenue()` - doanh thu theo ngày
- [ ] Implement `getPopularItems()` - món ăn bán chạy
- [ ] Implement `getOrdersByStatus()` - thống kê orders theo status
- [ ] Implement `getAveragePrepTime()` - thời gian chuẩn bị trung bình
- [ ] Implement `getDashboardSummary()` - tổng quan dashboard
- [ ] Tạo `ReportsController` với role-based access (admin only)
- [ ] Test tất cả report endpoints với Postman
- [ ] Verify date range filters hoạt động
- [ ] Kiểm tra performance với large datasets

---

## 📋 TASK 2.5: NOTIFICATION BELL COMPONENT (8 giờ)

### **Mục đích:**

Tạo component notification bell ở header để hiển thị real-time notifications với unread badge.

### **Implementation Steps:**

#### **Bước 1: Cài đặt dependencies**

```bash
cd frontend
npm install socket.io-client react-hot-toast react-icons
```

#### **Bước 2: Tạo Socket Context**

Tạo file: `frontend/src/contexts/SocketContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (!token) return;

    // Initialize Socket.IO connection
    const socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3000/notifications",
      {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    socketInstance.on("connect", () => {
      console.log("✅ Socket connected:", socketInstance.id);
      setIsConnected(true);
      toast.success("Connected to real-time updates");
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
```

#### **Bước 3: Tạo Notifications Context**

Tạo file: `frontend/src/contexts/NotificationsContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";
import api from "../api/axios";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get("/notifications");
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/notifications/${id}`);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((prev) => {
          const deleted = notifications.find((n) => n.id === id);
          return deleted && !deleted.is_read ? Math.max(0, prev - 1) : prev;
        });
      } catch (error) {
        console.error("Failed to delete notification:", error);
      }
    },
    [notifications]
  );

  // Listen to real-time events
  useEffect(() => {
    if (!socket || !user) return;

    // New order notification (for waiters)
    socket.on("new_order", (data) => {
      console.log("📦 New order notification:", data);
      toast("🔔 " + data.message, {
        icon: "📦",
        duration: 5000,
      });
      fetchNotifications();
    });

    // Order accepted (for kitchen & customer)
    socket.on("order_accepted", (data) => {
      console.log("✅ Order accepted:", data);
      toast.success(data.message);
      fetchNotifications();
    });

    // Order ready (for waiter & customer)
    socket.on("order_ready", (data) => {
      console.log("🍽️ Order ready:", data);
      toast("🍽️ " + data.message, {
        icon: "✅",
        duration: 5000,
      });
      fetchNotifications();
    });

    // Order status update (for customer)
    socket.on("order_status_update", (data) => {
      console.log("🔄 Order status update:", data);
      toast(data.message);
      fetchNotifications();
    });

    // Order rejected
    socket.on("order_rejected", (data) => {
      console.log("❌ Order rejected:", data);
      toast.error(data.message);
      fetchNotifications();
    });

    return () => {
      socket.off("new_order");
      socket.off("order_accepted");
      socket.off("order_ready");
      socket.off("order_status_update");
      socket.off("order_rejected");
    };
  }, [socket, user, fetchNotifications]);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
```

#### **Bước 4: Tạo NotificationBell Component**

Tạo file: `frontend/src/components/NotificationBell.tsx`

```typescript
import React, { useState, useRef, useEffect } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "../contexts/NotificationsContext";
import { formatDistanceToNow } from "date-fns";
import "./NotificationBell.css";

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate to relevant page based on notification type
    if (notification.data?.order_id) {
      window.location.href = `/admin/orders/${notification.data.order_id}`;
    }
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="dropdown">
          <div className="dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="mark-all-btn">
                Mark all as read
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="empty-state">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    !notification.is_read ? "unread" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="time">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_order":
      return "📦";
    case "order_accepted":
      return "✅";
    case "order_ready":
      return "🍽️";
    case "order_served":
      return "😊";
    case "order_rejected":
      return "❌";
    default:
      return "🔔";
  }
}
```

#### **Bước 5: Tạo CSS cho NotificationBell**

Tạo file: `frontend/src/components/NotificationBell.css`

```css
.notification-bell {
  position: relative;
  display: inline-block;
}

.bell-button {
  position: relative;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.bell-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.bell-button .badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 380px;
  max-height: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.dropdown-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.mark-all-btn {
  background: transparent;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
}

.mark-all-btn:hover {
  text-decoration: underline;
}

.notifications-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #9ca3af;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.notification-item:hover {
  background-color: #f9fafb;
}

.notification-item.unread {
  background-color: #eff6ff;
}

.notification-item.unread::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #3b82f6;
}

.notification-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-content h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.notification-content p {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 4px 0;
  line-height: 1.4;
}

.notification-content .time {
  font-size: 12px;
  color: #9ca3af;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.delete-btn:hover {
  background-color: #fee2e2;
  color: #ef4444;
}
```

#### **Bước 6: Integrate vào App**

Cập nhật file: `frontend/src/App.tsx`

```typescript
import { Toaster } from "react-hot-toast";
import { SocketProvider } from "./contexts/SocketContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationsProvider>
          <BrowserRouter>{/* Your routes */}</BrowserRouter>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
            }}
          />
        </NotificationsProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
```

#### **Bước 7: Thêm NotificationBell vào Header**

Cập nhật file: `frontend/src/components/AdminLayout.tsx` (or your header component)

```typescript
import { NotificationBell } from "./NotificationBell";

export const AdminLayout: React.FC = ({ children }) => {
  return (
    <div className="admin-layout">
      <header className="header">
        <div className="logo">Smart Restaurant</div>
        <div className="header-actions">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
};
```

### ✅ **Task 2.5 Checklist:**

- [ ] Cài đặt `socket.io-client` và `react-hot-toast`
- [ ] Tạo `SocketContext` với JWT authentication
- [ ] Tạo `NotificationsContext` để manage notifications state
- [ ] Tạo `NotificationBell` component với dropdown
- [ ] Implement unread badge
- [ ] Listen to real-time events (new_order, order_accepted, etc.)
- [ ] Show toast notifications khi nhận event
- [ ] Implement mark as read functionality
- [ ] Implement delete notification
- [ ] Test với multiple roles (waiter, kitchen, customer)
- [ ] Verify real-time updates hoạt động
- [ ] Kiểm tra UI responsive

---

## 📋 TASK 2.6: REPORTS & ANALYTICS PAGE (14 giờ)

### **Mục đích:**

Tạo trang báo cáo với charts hiển thị revenue, popular items, order status distribution.

### **Implementation Steps:**

#### **Bước 1: Cài đặt dependencies**

```bash
npm install recharts date-fns
```

#### **Bước 2: Tạo API functions cho reports**

Tạo file: `frontend/src/api/reportsApi.ts`

```typescript
import api from "./axios";

export interface DailyRevenueData {
  date: string;
  total_revenue: number;
  total_orders: number;
  subtotal: number;
  tax: number;
}

export interface PopularItem {
  menu_item_id: string;
  name: string;
  category: string;
  total_quantity: number;
  total_revenue: number;
  times_ordered: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
  total_revenue: number;
}

export interface DashboardSummary {
  today_revenue: number;
  today_orders_count: number;
  pending_orders: number;
  preparing_orders: number;
  ready_orders: number;
}

export const reportsApi = {
  getDailyRevenue: async (
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyRevenueData[]> => {
    const response = await api.get("/reports/daily-revenue", {
      params: {
        restaurant_id: restaurantId,
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  getPopularItems: async (
    restaurantId: string,
    limit = 10,
    days = 30
  ): Promise<PopularItem[]> => {
    const response = await api.get("/reports/popular-items", {
      params: { restaurant_id: restaurantId, limit, days },
    });
    return response.data;
  },

  getOrdersByStatus: async (
    restaurantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<OrdersByStatus[]> => {
    const response = await api.get("/reports/orders-by-status", {
      params: {
        restaurant_id: restaurantId,
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  getAveragePrepTime: async (
    restaurantId: string,
    days = 7
  ): Promise<{
    average_prep_time_minutes: number;
    orders_analyzed: number;
  }> => {
    const response = await api.get("/reports/average-prep-time", {
      params: { restaurant_id: restaurantId, days },
    });
    return response.data;
  },

  getDashboardSummary: async (
    restaurantId: string
  ): Promise<DashboardSummary> => {
    const response = await api.get("/reports/dashboard-summary", {
      params: { restaurant_id: restaurantId },
    });
    return response.data;
  },
};
```

#### **Bước 3: Tạo ReportsPage**

Tạo file: `frontend/src/pages/admin/ReportsPage.tsx`

```typescript
import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { reportsApi } from "../../api/reportsApi";
import { format, subDays } from "date-fns";
import "./ReportsPage.css";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [restaurantId] = useState("YOUR_RESTAURANT_ID"); // Get from context or auth

  const [revenueData, setRevenueData] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [ordersByStatus, setOrdersByStatus] = useState([]);
  const [avgPrepTime, setAvgPrepTime] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const [revenue, items, statusData, prepTime] = await Promise.all([
        reportsApi.getDailyRevenue(
          restaurantId,
          dateRange.startDate,
          dateRange.endDate
        ),
        reportsApi.getPopularItems(restaurantId, 10, 30),
        reportsApi.getOrdersByStatus(
          restaurantId,
          dateRange.startDate,
          dateRange.endDate
        ),
        reportsApi.getAveragePrepTime(restaurantId, 7),
      ]);

      setRevenueData(revenue);
      setPopularItems(items);
      setOrdersByStatus(statusData);
      setAvgPrepTime(prepTime);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div className="date-range-picker">
          <label>
            From:
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </label>
          <label>
            To:
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </label>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="chart-card">
        <h2>Daily Revenue</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="total_revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="total_orders"
              stroke="#10b981"
              strokeWidth={2}
              name="Orders"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="charts-grid">
        {/* Popular Items Chart */}
        <div className="chart-card">
          <h2>Top 10 Popular Items</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={popularItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="total_quantity"
                fill="#3b82f6"
                name="Quantity Sold"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status */}
        <div className="chart-card">
          <h2>Orders by Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={ordersByStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {ordersByStatus.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Average Prep Time</h3>
          <p className="stat-value">
            {avgPrepTime?.average_prep_time_minutes || 0} min
          </p>
          <p className="stat-label">
            Based on {avgPrepTime?.orders_analyzed || 0} orders
          </p>
        </div>

        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p className="stat-value">
            $
            {revenueData
              .reduce((sum: number, d: any) => sum + d.total_revenue, 0)
              .toFixed(2)}
          </p>
          <p className="stat-label">Last 30 days</p>
        </div>

        <div className="stat-card">
          <h3>Total Orders</h3>
          <p className="stat-value">
            {revenueData.reduce(
              (sum: number, d: any) => sum + d.total_orders,
              0
            )}
          </p>
          <p className="stat-label">Last 30 days</p>
        </div>
      </div>
    </div>
  );
};
```

#### **Bước 4: Tạo CSS cho ReportsPage**

Tạo file: `frontend/src/pages/admin/ReportsPage.css`

```css
.reports-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.date-range-picker {
  display: flex;
  gap: 16px;
}

.date-range-picker label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
}

.date-range-picker input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.chart-card h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 12px 0;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
}

.stat-label {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  font-size: 18px;
  color: #6b7280;
}
```

### ✅ **Task 2.6 Checklist:**

- [ ] Cài đặt `recharts` và `date-fns`
- [ ] Tạo `reportsApi.ts` với typed API functions
- [ ] Tạo `ReportsPage` component
- [ ] Implement Daily Revenue line chart
- [ ] Implement Popular Items bar chart
- [ ] Implement Orders by Status pie chart
- [ ] Add date range picker
- [ ] Display summary statistics (avg prep time, total revenue, total orders)
- [ ] Test với real data từ backend
- [ ] Verify charts render correctly
- [ ] Make responsive cho mobile
- [ ] Add loading states

---

## ✅ **MEMBER 1 (HẢI) - SPRINT 2 COMPLETION CHECKLIST**

### Backend Tasks:

- [ ] Socket.IO server setup và running
- [ ] JWT authentication cho WebSocket connections
- [ ] NotificationsGateway với room-based broadcasting
- [ ] NotificationsService với database persistence
- [ ] Real-time order notifications (new_order, order_accepted, order_ready, order_served, order_rejected)
- [ ] Notifications CRUD API endpoints
- [ ] Reports service với analytics queries
- [ ] Reports controller với role-based access
- [ ] All report endpoints tested và returning correct data

### Frontend Tasks:

- [ ] SocketContext với auto-reconnect
- [ ] NotificationsContext với real-time updates
- [ ] NotificationBell component với unread badge
- [ ] Toast notifications cho real-time events
- [ ] Notifications dropdown với mark as read/delete
- [ ] ReportsPage với multiple charts
- [ ] Date range filtering
- [ ] Responsive design

### Integration Tests:

- [ ] WebSocket connection established successfully
- [ ] JWT authentication verified
- [ ] Real-time notifications delivered to correct roles
- [ ] Notifications saved to database
- [ ] Toast notifications display correctly
- [ ] Reports data accurate
- [ ] Charts render with real data
- [ ] Date filtering works correctly

---
