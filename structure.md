Searched codebase for "#codebase đọc toàn bộ dự án và tổng hợp các công nghệ đã sử dụng mà cách thức hoạt động tương ứng chi tiết ", 21 results

Searched codebase for "project configuration dependencies package.json build.gradle technologies stack", 19 results

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/package.json#1-1), lines 1 to 80

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/android/app/build.gradle.kts)

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/prisma/schema.prisma#1-1), lines 1 to 300

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/main.ts)

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/app.module.ts)

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/chat/chat.gateway.ts#1-1), lines 1 to 150

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/upload/upload.service.ts)

Searched for files matching `**/payment/*.ts`, 3 matches

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/payment/vnpay.service.ts#1-1), lines 1 to 200

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/notifications/notifications.service.ts#1-1), lines 1 to 100

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/auth/auth.service.ts#1-1), lines 1 to 100

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules/ai/ai.service.ts)

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/android/app/src/main/java/com/prompters/shopeeclone/data/repository/AuthRepository.kt)

Searched for files matching `**/di/*.kt`, no matches

Searched for regex `@Module|@Provides|@HiltAndroidApp` (`**/*.kt`), 20 results

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/android/app/src/main/java/com/prompters/shopeeclone/data/api/NetworkModule.kt#1-1), lines 1 to 100

Searched for regex `Socket|io.socket` (`**/*.kt`), 20 results

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/android/app/src/main/java/com/prompters/shopeeclone/data/manager/SocketManager.kt#1-1), lines 1 to 150

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/backend/src/modules)

Read [](file:///c%3A/Users/ADMIN/Desktop/TN/MobileApplicationDevelopment/Prompters-shop-MAD/android/app/src/main/java/com/prompters/shopeeclone/ui/screens)

Dựa trên phân tích toàn diện dự án, dưới đây là **TỔNG HỢP CÔNG NGHỆ VÀ CÁCH THỨC HOẠT ĐỘNG** của ứng dụng Shopee Clone:

---

# 📱 TỔNG HỢP CÔNG NGHỆ DỰ ÁN SHOPEE CLONE

## 🏗️ KIẾN TRÚC TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANDROID (Kotlin + Compose)                   │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer: Jetpack Compose + Material 3                         │
│  State Management: ViewModel + StateFlow                        │
│  DI: Dagger Hilt                                                │
│  Network: Retrofit + OkHttp + Gson                              │
│  Realtime: Socket.io Client                                     │
│  Image Loading: Coil                                            │
│  Local Storage: DataStore Preferences                           │
│  Auth: Credential Manager + Google Identity                     │
│  Push Notifications: Firebase Cloud Messaging                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP REST API / WebSocket
┌───────────────────────▼─────────────────────────────────────────┐
│                    BACKEND (NestJS + TypeScript)                │
├─────────────────────────────────────────────────────────────────┤
│  Framework: NestJS 11                                           │
│  ORM: Prisma 7 (PostgreSQL)                                     │
│  Auth: JWT + Passport + bcrypt                                  │
│  Realtime: Socket.io (WebSocket Gateway)                        │
│  Payment: VNPay Integration                                     │
│  AI: Google Gemini API                                          │
│  Storage: Supabase Storage                                      │
│  Push: Firebase Admin SDK                                       │
│  Email: Nodemailer (Gmail SMTP)                                 │
│  API Docs: Swagger/OpenAPI                                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                    DATABASE & SERVICES                          │
├─────────────────────────────────────────────────────────────────┤
│  Database: PostgreSQL (Supabase)                                │
│  Storage: Supabase Storage (2 buckets)                          │
│  Auth Provider: Supabase Auth (Google OAuth)                    │
│  Push Service: Firebase Cloud Messaging                         │
│  Payment Gateway: VNPay Sandbox                                 │
│  AI Service: Google Gemini 3 Flash                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 ANDROID - FRONTEND

### 1. **Jetpack Compose + Material 3**

- **Công nghệ**: Declarative UI framework
- **Cách hoạt động**:
  - UI được xây dựng bằng `@Composable` functions
  - State-driven rendering với `remember` và `mutableStateOf`
  - Navigation qua `NavHostController` với `composable()` routes
  - Material 3 Design System cho consistent UI/UX

```kotlin
@Composable
fun ProductCard(product: Product, onAddToCart: (String) -> Unit) {
    Card(modifier = Modifier.clickable { onAddToCart(product.id) }) {
        AsyncImage(model = product.imageUrl, ...)
        Text(text = product.name)
    }
}
```

### 2. **MVVM Architecture + Hilt DI**

- **Công nghệ**: ViewModel + StateFlow + Dagger Hilt
- **Cách hoạt động**:
  - **ViewModel**: Quản lý UI state, gọi Repository
  - **StateFlow**: Reactive state container, UI observe để update
  - **Hilt**: Dependency Injection tự động với `@Inject`, `@HiltViewModel`
  - Lifecycle-aware: ViewModel survive configuration changes

```kotlin
@HiltViewModel
class ProductViewModel @Inject constructor(
    private val repository: ProductRepository
) : ViewModel() {
    private val _state = MutableStateFlow<ProductState>(ProductState.Loading)
    val state: StateFlow<ProductState> = _state.asStateFlow()

    fun loadProducts() {
        viewModelScope.launch {
            repository.getProducts().fold(
                onSuccess = { _state.value = ProductState.Success(it) },
                onFailure = { _state.value = ProductState.Error(it.message) }
            )
        }
    }
}
```

### 3. **Retrofit + OkHttp**

- **Công nghệ**: HTTP client for REST API
- **Cách hoạt động**:
  - `Retrofit`: Convert HTTP API thành Kotlin interface
  - `OkHttpClient`: HTTP client với interceptors
  - `AuthInterceptor`: Tự động inject JWT token vào header
  - `GsonConverterFactory`: JSON ↔ Kotlin object serialization

```kotlin
interface ProductApiService {
    @GET("products")
    suspend fun getProducts(
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ProductListResponse>
}

// Interceptor tự động thêm token
class AuthInterceptor : Interceptor {
    override fun intercept(chain: Chain): Response {
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        return chain.proceed(request)
    }
}
```

### 4. **Socket.io Client**

- **Công nghệ**: Realtime communication
- **Cách hoạt động**:
  - Connect với JWT token qua query params
  - Join/Leave conversation rooms
  - Listen events: `new_message`, `order_status_updated`, `new_order`
  - Broadcast typing indicators
  - Auto-reconnect khi mất kết nối

```kotlin
class SocketManager {
    fun connect(token: String) {
        socket = IO.socket("http://10.0.2.2:3000/chat", IO.Options().apply {
            query = "token=$token"
        })
        socket?.on("new_message") { args -> /* handle message */ }
        socket?.connect()
    }

    fun joinConversation(conversationId: String) {
        socket?.emit("join_conversation", JSONObject().put("conversationId", conversationId))
    }
}
```

### 5. **Firebase Cloud Messaging**

- **Công nghệ**: Push notifications
- **Cách hoạt động**:
  - Đăng ký FCM token khi login thành công
  - Gửi token lên backend để lưu trữ
  - Receive notifications qua `FirebaseMessagingService`
  - Handle notification click → navigate to relevant screen

### 6. **Coil**

- **Công nghệ**: Image loading library
- **Cách hoạt động**:
  - `AsyncImage` composable load ảnh từ URL
  - Auto caching (memory + disk)
  - Placeholder và error handling
  - Support WebP, GIF, SVG

### 7. **DataStore Preferences**

- **Công nghệ**: Local storage for key-value data
- **Cách hoạt động**:
  - Thay thế SharedPreferences
  - Coroutine-based, type-safe
  - Lưu: JWT token, user info, settings

---

## ⚙️ BACKEND - NESTJS

### 1. **NestJS Framework**

- **Công nghệ**: Progressive Node.js framework
- **Cách hoạt động**:
  - **Modules**: Tổ chức code theo feature (AuthModule, ProductsModule...)
  - **Controllers**: Handle HTTP requests, route mapping
  - **Services**: Business logic
  - **Guards**: Authentication/Authorization
  - **Pipes**: Validation (class-validator)
  - **Interceptors**: Logging, transformation

```typescript
@Module({
  imports: [DatabaseModule, JwtModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

@Controller("auth")
export class AuthController {
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

### 2. **Prisma ORM**

- **Công nghệ**: Next-generation ORM for TypeScript
- **Cách hoạt động**:
  - Schema-first: Định nghĩa models trong schema.prisma
  - Auto-generate TypeScript types
  - Type-safe queries
  - Migrations: `prisma migrate dev`
  - Introspection: Sync với database hiện có

```prisma
model products {
  id          String    @id @default(uuid()) @db.Uuid
  name        String
  price       Decimal   @db.Decimal(12, 2)
  shop        shops     @relation(fields: [shop_id], references: [id])
  reviews     reviews[]
}
```

### 3. **JWT Authentication + Passport**

- **Công nghệ**: Token-based authentication
- **Cách hoạt động**:
  - Login → Generate Access Token (7 days) + Refresh Token
  - Client gửi token trong `Authorization: Bearer <token>`
  - `JwtAuthGuard` verify token mỗi request
  - `JwtStrategy` extract user info từ token payload

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    async validate(payload: JwtPayload) {
        return { userId: payload.userId, email: payload.email, role: payload.role };
    }
}

@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
    return req.user;
}
```

### 4. **Socket.io Gateway (WebSocket)**

- **Công nghệ**: Realtime bidirectional communication
- **Cách hoạt động**:
  - `@WebSocketGateway`: Định nghĩa WebSocket server
  - `@SubscribeMessage`: Handle events từ client
  - Room-based: Clients join rooms (conversations)
  - Broadcast: Emit events to specific rooms/users
  - JWT auth qua query params

```typescript
@WebSocketGateway({ namespace: "/chat", cors: { origin: "*" } })
export class ChatGateway {
  @SubscribeMessage("join_conversation")
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
  }

  emitNewMessage(conversationId: string, message: any) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit("new_message", message);
  }
}
```

### 5. **VNPay Integration**

- **Công nghệ**: Vietnam payment gateway
- **Cách hoạt động**:
  - Tạo payment URL với hash signature (HMAC-SHA512)
  - Redirect user đến VNPay checkout page
  - VNPay callback sau khi thanh toán
  - Verify callback signature
  - Update order payment status

```typescript
async createPaymentUrl(orderId: string, amount: number, ...): Promise<string> {
    const vnpParams = {
        vnp_TmnCode: this.vnpTmnCode,
        vnp_Amount: amount * 100,
        vnp_CreateDate: this.formatDate(new Date()),
        vnp_TxnRef: orderId,
        // ... more params
    };
    const signData = this.sortAndEncode(vnpParams);
    const secureHash = crypto.createHmac('sha512', this.vnpHashSecret)
        .update(signData).digest('hex');
    return `${this.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;
}
```

### 6. **Supabase Storage**

- **Công nghệ**: Cloud file storage
- **Cách hoạt động**:
  - 2 buckets: `product-images`, `avatars`
  - Upload via Supabase JS client
  - Generate public URL sau upload
  - Support upsert (replace existing files)

```typescript
async uploadProductImage(file: Express.Multer.File, userId: string): Promise<string> {
    const { data, error } = await this.supabase.storage
        .from('product-images')
        .upload(fileName, file.buffer, { contentType: file.mimetype });

    const { data: { publicUrl } } = this.supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

    return publicUrl;
}
```

### 7. **Firebase Admin SDK (FCM)**

- **Công nghệ**: Server-side push notifications
- **Cách hoạt động**:
  - Store FCM tokens per user (support multiple devices)
  - Send notification với title, body, data payload
  - Batch send cho nhiều users
  - Clean up invalid tokens

```typescript
async sendPushNotification(userId: string, notification: Notification) {
    const tokens = await this.db.fcm_tokens.findMany({ where: { user_id: userId } });

    await admin.messaging().sendEachForMulticast({
        tokens: tokens.map(t => t.token),
        notification: { title, body },
        data: { orderId, type }
    });
}
```

### 8. **Google Gemini AI**

- **Công nghệ**: Generative AI for product descriptions
- **Cách hoạt động**:
  - Seller nhập tên sản phẩm
  - Call Gemini API với prompt template
  - AI generate mô tả hấp dẫn với emoji
  - Auto-fill vào form tạo sản phẩm

```typescript
async generateProductDescription(productName: string) {
    const prompt = `Viết mô tả sản phẩm hấp dẫn cho: "${productName}"...`;
    const result = await this.model.generateContent(prompt);
    return { description: result.response.text() };
}
```

### 9. **Nodemailer (Email)**

- **Công nghệ**: SMTP email sending
- **Cách hoạt động**:
  - Forgot password → Generate reset token
  - Send email với reset link
  - User click link → Redirect to reset password page

---

## 🗄️ DATABASE SCHEMA

### Core Entities:

| Entity          | Mô tả                             |
| --------------- | --------------------------------- |
| `users`         | Buyer/Seller/Admin với FCM tokens |
| `shops`         | Seller's shop với wallet          |
| `products`      | Sản phẩm với categories, reviews  |
| `orders`        | Đơn hàng với order_details        |
| `cart_items`    | Giỏ hàng                          |
| `addresses`     | Địa chỉ giao hàng                 |
| `conversations` | Chat threads                      |
| `messages`      | Chat messages                     |
| `vouchers`      | Mã giảm giá (platform/shop)       |
| `wallet`        | Ví seller                         |
| `transactions`  | Giao dịch ví                      |

---

## 🔄 LUỒNG HOẠT ĐỘNG CHÍNH

### 1. **Authentication Flow**

```
[Android] → Login → [Backend] → Verify credentials → Generate JWT → Return tokens
[Android] → Store token in DataStore → Inject to all API requests
```

### 2. **Order Flow**

```
[Buyer] Add to Cart → Checkout → Create Order
    ↓
[Backend] Create order → Deduct stock → Notify seller (FCM + Socket)
    ↓
[Seller] Confirm → Ship → [Buyer] Receive → Complete
    ↓
[Backend] Release payment to seller wallet (after platform fee)
```

### 3. **Realtime Chat Flow**

```
[User A] Connect Socket → Join conversation room
[User B] Connect Socket → Join same room
    ↓
[User A] Send message → [Backend] Save to DB → Emit to room
    ↓
[User B] Receive 'new_message' event → Update UI instantly
```

### 4. **Payment Flow (VNPay)**

```
[Buyer] Select VNPay → [Backend] Generate payment URL
    ↓
[WebView] Open VNPay page → User pays
    ↓
[VNPay] Callback to backend → Verify signature → Update order status
    ↓
[Android] Deep link back to app → Show result screen
```

---

## 📊 MODULES OVERVIEW

| Module            | Android Screens                    | Backend API                              |
| ----------------- | ---------------------------------- | ---------------------------------------- |
| **Auth**          | Login, Register, ForgotPassword    | `/auth/*`                                |
| **Home**          | HomeScreen, Categories             | `/products`, `/categories`               |
| **Product**       | ProductDetail, Reviews             | `/products/:id`, `/products/:id/reviews` |
| **Cart**          | CartScreen                         | `/cart/*`                                |
| **Checkout**      | CheckoutScreen, AddressSelection   | `/orders`, `/addresses/*`                |
| **Orders**        | OrdersList, OrderDetails           | `/orders/*`                              |
| **Chat**          | ChatList, ChatDetail               | `/chat/*` + WebSocket                    |
| **Seller**        | Dashboard, Products, Orders        | `/seller/*`                              |
| **Admin**         | Dashboard, Shops, Users, Approvals | `/admin/*`                               |
| **Wallet**        | SellerFinance, UserWallet          | `/wallet/*`                              |
| **Vouchers**      | VoucherList, Apply                 | `/vouchers/*`                            |
| **Notifications** | NotificationsList                  | `/notifications/*`                       |

---

Đây là kiến trúc đầy đủ của ứng dụng Shopee Clone với công nghệ hiện đại và scalable! 🚀
