# Kế hoạch triển khai: Product Options & Variants

Phase này nâng cấp Product từ dạng đơn giản "1 product = 1 giá, 1 tồn kho" thành hệ thống có phân loại sản phẩm:

- **Product cha:** thông tin chung, category, shop/vendor, gallery ảnh.
- **Option group:** nhóm lựa chọn như Color, Storage, Size.
- **Option value:** giá trị lựa chọn như Black, Blue, 128GB, XL.
- **Variant:** SKU bán được, có giá riêng, tồn kho riêng, trạng thái active và ảnh riêng tùy chọn.

Trong phase này, mục tiêu refactor không phải là "dùng Factory Pattern cho bằng được". Hướng đúng hơn là:

- Service tách đúng boundary nghiệp vụ.
- Validator/Policy gom business rules.
- Mapper tách DTO mapping khỏi service/entity.
- Factory chỉ dùng nếu cần build entity phức tạp, không gọi repository trong factory.
- Resolver/helper giúp Cart/Order lấy đúng price, stock, image theo variant hoặc product.

---

## 1. Mục tiêu nghiệp vụ

### 1.1 Hiện tại

```text
Product
- name
- description
- price
- stockQuantity
- productImages

CartItem / OrderItem chỉ trỏ tới productId.
```

### 1.2 Sau phase này

```text
Product: "iPhone 15"
  Options:
    Color: Black, Blue
    Storage: 128GB, 256GB

  Variants:
    IP15-BLACK-128 -> price 22.990.000, stock 20
    IP15-BLACK-256 -> price 25.990.000, stock 10
    IP15-BLUE-128  -> price 22.990.000, stock 15
```

Quy tắc:

- Product không có variants vẫn hoạt động như hiện tại.
- Product có variants thì Cart/Checkout bắt buộc chọn `variantId`.
- Giá và tồn kho ưu tiên lấy từ variant.
- Ảnh hiển thị ưu tiên lấy từ variant image, nếu không có thì fallback về product primary image.
- OrderItem phải snapshot thông tin variant để lịch sử đơn hàng không bị đổi khi vendor sửa product.

---

## 2. Kiến thức cần nắm trước khi code

### 2.1 `@ManyToMany` và `@JoinTable` — Quan hệ Nhiều-Nhiều

**Tại sao cần hiểu:** Variant có quan hệ N:N với OptionValue. Một variant "Đen + S" chứa 2 giá trị. Giá trị "Đen" xuất hiện trong nhiều variant ("Đen+S", "Đen+M", "Đen+L").

```java
// Bên phía "chủ" (owning side) — ProductVariant
@ManyToMany
@JoinTable(
    name = "product_variant_option_values",       // Tên bảng trung gian
    joinColumns = @JoinColumn(name = "variant_id"),         // FK trỏ về Variant
    inverseJoinColumns = @JoinColumn(name = "option_value_id") // FK trỏ về OptionValue
)
private Set<ProductOptionValue> optionValues = new HashSet<>();
```

JPA sẽ tự tạo bảng trung gian `product_variant_option_values` với 2 cột:
```
product_variant_option_values
├── variant_id       (FK → product_variants.id)
└── option_value_id  (FK → product_option_values.id)
```

**Lưu ý quan trọng:**
- Dùng `Set<>` (không phải `List<>`) cho quan hệ `@ManyToMany`. Hibernate xử lý `Set` hiệu quả hơn — khi xóa 1 phần tử khỏi `List`, Hibernate xóa TẤT CẢ rồi insert lại, nhưng với `Set` thì chỉ xóa đúng phần tử đó.
- Nếu cần lưu thêm thông tin trên bảng trung gian (ví dụ: `sortOrder`), thì không dùng `@ManyToMany` nữa mà tạo entity riêng cho bảng trung gian.

**Từ khóa tìm hiểu:** `JPA ManyToMany JoinTable example`, `Hibernate Set vs List ManyToMany performance`, `owning side vs inverse side JPA`.

---

### 2.2 `@UniqueConstraint` — Chống dữ liệu trùng ở cấp Database

**Tại sao cần hiểu:** Cùng 1 product, không được có 2 option group cùng tên (VD: 2 group "Color"). Cùng 1 product, không được có 2 variant cùng SKU.

```java
@Entity
@Table(
    name = "product_option_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "name"})
)
public class ProductOptionGroup extends BaseEntity {
    // → Database sẽ tự chặn: INSERT 2 dòng có cùng product_id + name
}
```

**Khác biệt với validate ở Service:**
- `@UniqueConstraint` là **tuyến phòng thủ cuối** (database level). Nếu 2 request đến cùng lúc, database sẽ chặn request thứ 2.
- Validate ở Service (check `existsByProductIdAndNameIgnoreCase()`) là **tuyến đầu** — trả lỗi đẹp cho Frontend. Nhưng nếu 2 request cùng lúc vượt qua Service check, database vẫn chặn được.
- Nên dùng CẢ HAI: Service check để trả lỗi rõ ràng, `@UniqueConstraint` để đảm bảo tính toàn vẹn dữ liệu.

**Từ khóa tìm hiểu:** `JPA @UniqueConstraint composite key`, `Race condition database constraint`, `DataIntegrityViolationException Spring`.

---

### 2.3 Mapper Pattern — Tách logic chuyển đổi DTO khỏi Entity

**Tại sao cần hiểu:** Hiện tại `ProductResponse.fromEntity()`, `CartItemResponse.toDto()`, `OrderItemResponse.toDto()` nằm trực tiếp trong DTO class. Khi thêm variant, các hàm này sẽ phình to vì phải xử lý thêm options, variants, variant image. Nếu để trong DTO → DTO phụ thuộc vào quá nhiều entity khác → vi phạm Single Responsibility.

```text
HIỆN TẠI (Chưa có Mapper):
┌─────────────────────────┐
│ ProductResponse         │
│   fromEntity(Product p) │ ← Chứa logic mapping phức tạp
│                         │ ← Phải biết cách lấy images, category, vendor
│                         │ ← Sẽ phải biết cách lấy options, variants
└─────────────────────────┘

SAU KHI REFACTOR (Có Mapper):
┌──────────────────┐      ┌────────────────────┐
│ ProductResponse  │      │ ProductMapper      │
│ (chỉ chứa data) │ ←──  │  toResponse(p)     │ ← Logic mapping nằm ở đây
│                  │      │  toListResponse(p) │
└──────────────────┘      └────────────────────┘
```

**Cách triển khai:**
```java
@Component
@RequiredArgsConstructor
public class ProductMapper {
    private final ProductOptionMapper optionMapper;
    private final ProductVariantMapper variantMapper;

    public ProductResponse toResponse(Product product) {
        ProductResponse response = new ProductResponse();
        response.setId(product.getId());
        response.setName(product.getName());
        // ... map các trường cơ bản ...

        // Map options (gọi mapper con)
        if (product.getOptionGroups() != null) {
            response.setOptionGroups(product.getOptionGroups().stream()
                    .map(optionMapper::toResponse)
                    .toList());
        }

        // Map variants (gọi mapper con)
        if (product.getVariants() != null) {
            response.setVariants(product.getVariants().stream()
                    .filter(ProductVariant::getActive)
                    .map(variantMapper::toResponse)
                    .toList());
        }

        return response;
    }
}
```

**Tại sao dùng `@Component` chứ không dùng static method?**
Vì mapper có thể cần inject mapper con khác. Static method không inject được.

**Từ khóa tìm hiểu:** `Mapper Pattern Spring Boot`, `MapStruct vs manual mapper`, `Single Responsibility Principle DTO mapping`.

---

### 2.4 Validator Pattern — Tách business rules khỏi Service

**Tại sao cần hiểu:** Variant có RẤT NHIỀU rule phức tạp. Nếu nhét hết vào Service, hàm `createVariant()` sẽ dài 100+ dòng. Tách validator ra giúp:
1. Service chỉ lo điều phối luồng (orchestration).
2. Validator chỉ lo kiểm tra rule. Có thể reuse cho cả create lẫn update.
3. Dễ viết Unit Test cho validator (mock ít hơn).

```text
SERVICE FLOW:
createVariant(productId, request)
    │
    ├── 1. Load product, optionValues, image   ← Service lo
    ├── 2. Check ownership                     ← OwnershipService lo
    ├── 3. Validate business rules             ← Validator lo
    │       ├── SKU không trùng?
    │       ├── Option values thuộc đúng product?
    │       ├── Không chọn 2 values cùng 1 group?
    │       ├── Không trùng tổ hợp với variant khác?
    │       └── Image thuộc đúng product?
    ├── 4. Build entity                        ← Factory lo (optional)
    ├── 5. Save                                ← Service lo
    ├── 6. Sync product summary                ← SyncService lo
    └── 7. Map response                        ← Mapper lo
```

**Từ khóa tìm hiểu:** `Validation Pattern Spring Boot`, `Domain validation vs Bean validation`, `Separation of Concerns`.

---

### 2.5 NULL trong UNIQUE Constraint — Bẫy của PostgreSQL

**Tại sao cần hiểu:** `CartItem` sẽ có `(cart_id, product_id, variant_id)`. Với sản phẩm SIMPLE, `variant_id = NULL`. Trong PostgreSQL, `NULL != NULL`, nên unique constraint **KHÔNG hoạt động** khi có cột NULL.

```sql
-- PostgreSQL:
INSERT INTO cart_items (cart_id, product_id, variant_id) VALUES ('cart-1', 'prod-1', NULL);
INSERT INTO cart_items (cart_id, product_id, variant_id) VALUES ('cart-1', 'prod-1', NULL);
-- → CẢ HAI đều INSERT THÀNH CÔNG! Unique constraint KHÔNG chặn.
-- → Vì NULL != NULL trong SQL standard.
```

**Giải pháp:** Tạo Partial Unique Index (chỉ PostgreSQL hỗ trợ):
```sql
-- Index cho Simple Product (variant_id IS NULL)
CREATE UNIQUE INDEX idx_cart_item_simple
    ON cart_items(cart_id, product_id)
    WHERE variant_id IS NULL;

-- Index cho Variable Product (variant_id IS NOT NULL)
CREATE UNIQUE INDEX idx_cart_item_variant
    ON cart_items(cart_id, product_id, variant_id)
    WHERE variant_id IS NOT NULL;
```

Trong Spring Boot, bạn vẫn nên check duplicate ở Service layer trước để trả lỗi rõ ràng cho Frontend.

**Từ khóa tìm hiểu:** `PostgreSQL partial unique index`, `NULL in unique constraint SQL standard`, `JPA unique constraint nullable column`.

---

### 2.6 Snapshot Data — Tại sao OrderItem cần lưu thừa thông tin

**Tại sao cần hiểu:** Sau khi customer mua hàng, vendor có thể: đổi tên product, xóa variant, đổi SKU, đổi ảnh. Nếu OrderItem chỉ lưu `productId` và `variantId` rồi JOIN khi hiển thị → lịch sử đơn hàng sẽ sai hoặc lỗi (variant đã bị xóa).

```text
KHÔNG SNAPSHOT (Sai):
OrderItem
├── productId ────JOIN──→ Product.name  ← Vendor đổi tên → Đơn cũ hiện tên mới!
└── variantId ────JOIN──→ Variant.sku   ← Vendor xóa variant → Đơn cũ bị lỗi!

CÓ SNAPSHOT (Đúng):
OrderItem
├── productId            ← Vẫn lưu FK để truy vấn
├── productNameAtPurchase: "iPhone 15"     ← Snapshot: không bao giờ thay đổi
├── variantSkuAtPurchase: "IP15-BLACK-128" ← Snapshot: không bao giờ thay đổi
├── selectedOptions: '{"Color":"Black","Storage":"128GB"}' ← Snapshot JSON
├── thumbnailUrl: "https://..."            ← Snapshot ảnh
└── priceAtPurchase: 22990000              ← Đã có sẵn từ trước
```

**Quy tắc vàng trong E-commerce:** Mọi thông tin hiển thị trên trang "Lịch sử đơn hàng" PHẢI được snapshot tại thời điểm checkout, KHÔNG BAO GIỜ phụ thuộc vào dữ liệu hiện tại của Product/Variant.

**Từ khóa tìm hiểu:** `Event sourcing snapshot pattern`, `Immutable data e-commerce`, `Order history data integrity`.

---

## 3. Pattern áp dụng trong phase này

### 3.1 Mapper Pattern

Tạo package:

```text
mapper/
  ProductMapper.java
  ProductImageMapper.java
  ProductOptionMapper.java
  ProductVariantMapper.java
  CartItemMapper.java
  OrderItemMapper.java
```

Service chỉ lo nghiệp vụ, mapper lo response.

### 3.2 Validator / Policy Pattern

Tạo package:

```text
validator/
  ProductVariantValidator.java
  ProductOptionValidator.java
```

`ProductVariantValidator` cần kiểm tra:

- SKU không trùng trong phạm vi product.
- Option values phải thuộc đúng product.
- Mỗi variant không được chọn 2 values trong cùng 1 option group.
- Không được tạo 2 variants có cùng tổ hợp option values.
- Image nếu có phải thuộc đúng product.

### 3.3 Factory Pattern chỉ là optional

Factory có thể dùng để build entity, nhưng không nên:

- Gọi repository.
- Check ownership.
- Save database.
- Điều phối transaction.

### 3.4 Ownership Service

```text
HIỆN TẠI (Copy-paste ownership check ở mỗi Service):
ProductServiceImpl.updateProduct()   → copy logic check vendor
ProductServiceImpl.deleteProduct()   → copy logic check vendor
ImageServiceImpl.uploadImage()       → copy logic check vendor

SAU KHI REFACTOR:
OwnershipService.checkProductOwner(product) → MỌI Service gọi chung 1 chỗ
```

### 3.5 Resolver/Helper cho Cart và Order

Cart/Order cần lấy đúng giá, tồn kho, ảnh:

```java
private BigDecimal resolveUnitPrice(Product product, ProductVariant variant) {
    return variant != null ? variant.getPrice() : product.getPrice();
}

private int resolveAvailableStock(Product product, ProductVariant variant) {
    return variant != null ? variant.getStockQuantity() : product.getStockQuantity();
}
```

---

## 4. Entity design

### 4.1 Enum ProductType

```java
package com.springboot.techmart.entity;

public enum ProductType {
    SIMPLE,    // Sản phẩm đơn giản: 1 giá, 1 tồn kho (VD: Cáp sạc)
    VARIABLE   // Sản phẩm có biến thể: giá/tồn kho nằm ở variant (VD: Áo thun có màu/size)
}
```

### 4.2 Product — Thêm trường mới

Giữ `price` và `stockQuantity` để backward compatible:

- Product không có variants: `price`, `stockQuantity` là giá/tồn kho thật.
- Product có variants: `price` là min price, `stockQuantity` là tổng tồn kho active variants.

Thêm vào `Product.java`:

```java
// Loại sản phẩm: SIMPLE hoặc VARIABLE
// Mặc định SIMPLE → tất cả sản phẩm cũ tự động là SIMPLE, không vỡ code
@Enumerated(EnumType.STRING)
@Column(name = "product_type", nullable = false)
private ProductType productType = ProductType.SIMPLE;

// Danh sách nhóm thuộc tính (Color, Size, Storage)
@OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
@OrderBy("sortOrder ASC")
private List<ProductOptionGroup> optionGroups = new ArrayList<>();

// Danh sách biến thể (SKU cụ thể)
@OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
private List<ProductVariant> variants = new ArrayList<>();
```

### 4.3 ProductOptionGroup

```java
package com.springboot.techmart.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "product_option_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "name"})
)
@Getter @Setter @NoArgsConstructor
public class ProductOptionGroup extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // Tên nhóm thuộc tính: "Màu sắc", "Size", "Dung lượng"
    @Column(nullable = false)
    private String name;

    // Thứ tự hiển thị trên Frontend
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    // Danh sách giá trị: "Đen", "Trắng", "S", "M", "L"
    @OneToMany(mappedBy = "optionGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductOptionValue> values = new ArrayList<>();
}
```

### 4.4 ProductOptionValue

```java
package com.springboot.techmart.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "product_option_values",
    uniqueConstraints = @UniqueConstraint(columnNames = {"option_group_id", "value"})
)
@Getter @Setter @NoArgsConstructor
public class ProductOptionValue extends BaseEntity {

    // Thuộc về Option Group nào
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_group_id", nullable = false)
    private ProductOptionGroup optionGroup;

    // Giá trị cụ thể: "Đen", "Trắng", "S", "M"
    @Column(nullable = false)
    private String value;

    // Tên hiển thị (tùy chọn): "Đen Huyền Bí", "Trắng Ngà"
    // Nếu null → Frontend hiển thị trường `value`
    @Column(name = "display_name")
    private String displayName;

    // Mã màu hex (tùy chọn, chỉ dùng cho option loại Color)
    // Frontend dùng để render ô màu: <div style="background: #000000">
    @Column(name = "color_hex")
    private String colorHex;

    // Thứ tự hiển thị
    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
```

### 4.5 ProductVariant

Không lưu `imageUrl` string. Dùng liên kết tới `ProductImage`.

```java
package com.springboot.techmart.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
    name = "product_variants",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "sku"})
)
@Getter @Setter @NoArgsConstructor
public class ProductVariant extends BaseEntity {

    // Thuộc về Product nào
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // Mã SKU duy nhất trong phạm vi product: "AOTHUN-DEN-S", "IP15-BLACK-128GB"
    @Column(nullable = false)
    private String sku;

    // GIÁ RIÊNG cho biến thể này
    @Column(nullable = false)
    private BigDecimal price;

    // TỒN KHO RIÊNG cho biến thể này
    @Column(name = "stock_quantity", nullable = false)
    private Integer stockQuantity;

    // Có đang bán hay không (Vendor có thể tắt 1 variant mà không xóa)
    @Column(nullable = false)
    private Boolean active = true;

    // Ảnh riêng cho variant (FK tới ProductImage)
    // VD: Ảnh áo màu đen khác ảnh áo màu trắng
    // Nếu null → Frontend fallback về product primary image
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_id")
    private ProductImage image;

    // Bảng trung gian: Variant này chứa những OptionValue nào
    // VD: Variant "AOTHUN-DEN-S" chứa 2 giá trị: "Đen" (từ Option Màu) + "S" (từ Option Size)
    @ManyToMany
    @JoinTable(
        name = "product_variant_option_values",
        joinColumns = @JoinColumn(name = "variant_id"),
        inverseJoinColumns = @JoinColumn(name = "option_value_id")
    )
    private Set<ProductOptionValue> optionValues = new HashSet<>();

    // Optimistic Locking — bảo vệ tồn kho variant khỏi race condition khi checkout
    @Version
    private Long version;
}
```

### 4.6 CartItem — Thêm liên kết Variant

```java
// Thêm vào CartItem.java:
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "variant_id")
private ProductVariant variant;
```

Lưu ý unique constraint: `UNIQUE(cart_id, product_id, variant_id)` không chặn duplicate nếu `variant_id` là `NULL` trong PostgreSQL. Service phải check duplicate:
- Simple product: tìm CartItem có cùng `(cartId, productId)` và `variant == null`.
- Variable product: tìm CartItem có cùng `(cartId, productId, variantId)`.

### 4.7 OrderItem — Thêm snapshot

```java
// Thêm vào OrderItem.java:

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "variant_id")
private ProductVariant variant;

// Snapshot tên sản phẩm lúc mua (vendor có thể đổi tên sau)
@Column(name = "product_name_at_purchase")
private String productNameAtPurchase;

// Snapshot SKU tại thời điểm mua (vendor có thể đổi SKU sau)
@Column(name = "variant_sku_at_purchase")
private String variantSkuAtPurchase;

// Snapshot thông tin biến thể dạng text: "Color: Đen, Size: S"
// Đảm bảo đơn hàng cũ vẫn hiển thị đúng dù vendor xóa variant
@Column(name = "selected_options", columnDefinition = "TEXT")
private String selectedOptions;

// Snapshot ảnh tại thời điểm mua
@Column(name = "thumbnail_url")
private String thumbnailUrl;
```

---

## 5. Repository

```java
public interface ProductOptionGroupRepository extends JpaRepository<ProductOptionGroup, UUID> {
    List<ProductOptionGroup> findByProductIdOrderBySortOrderAsc(UUID productId);
    boolean existsByProductIdAndNameIgnoreCase(UUID productId, String name);
}
```

```java
public interface ProductOptionValueRepository extends JpaRepository<ProductOptionValue, UUID> {
    List<ProductOptionValue> findByIdIn(Collection<UUID> ids);
}
```

```java
public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {
    List<ProductVariant> findByProductIdAndActiveTrue(UUID productId);
    boolean existsByProductIdAndSkuIgnoreCase(UUID productId, String sku);
}
```

> **Tại sao `findByIdIn(Collection<UUID> ids)`?**
> Khi tạo Variant, Frontend gửi lên `Set<UUID> optionValueIds` (VD: [uuid-đen, uuid-S]). Service cần load tất cả OptionValue entity từ DB bằng 1 câu query duy nhất thay vì gọi `findById()` trong vòng lặp (tránh N+1).

---

## 6. DTO design

### 6.1 ProductRequest — KHÔNG thay đổi

```java
// Giữ nguyên ProductRequest hiện tại.
// Variant được tạo qua API riêng, không trộn vào request tạo product.
public class ProductRequest {
    private String name;
    private String description;
    private BigDecimal price;
    private Integer stockQuantity;
    private UUID categoryId;
}
```

Lý do: Nếu nhét `options` + `variants` vào `ProductRequest`, class này sẽ quá phức tạp, khó validate, và vi phạm Single Responsibility. Tạo option/variant qua API riêng giúp:
- Frontend linh hoạt hơn (tạo product trước, thêm option/variant sau).
- Validate từng bước, lỗi ở đâu biết ở đó.
- Service code ngắn gọn.

### 6.2 Option DTO

```java
@Getter @Setter
public class ProductOptionGroupRequest {
    @NotBlank(message = "Tên nhóm thuộc tính không được để trống")
    private String name;         // "Màu sắc"
    private Integer sortOrder;   // 0
}
```

```java
@Getter @Setter
public class ProductOptionValueRequest {
    @NotBlank(message = "Giá trị không được để trống")
    private String value;            // "Đen"
    private String displayName;      // "Đen Huyền Bí" (tùy chọn)
    private String colorHex;         // "#000000" (tùy chọn)
    private Integer sortOrder;       // 0
}
```

### 6.3 Variant DTO

```java
@Getter @Setter
public class ProductVariantRequest {
    @NotBlank(message = "SKU không được để trống")
    private String sku;                          // "AOTHUN-DEN-S"

    @NotNull @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal price;                    // 180000

    @NotNull @Min(0)
    private Integer stockQuantity;               // 10

    private Boolean active = true;

    // FK tới ProductImage.id (ảnh riêng cho variant, nullable)
    private UUID imageId;

    // Danh sách UUID của OptionValue — KHÔNG dùng string
    @NotEmpty(message = "Biến thể phải có ít nhất 1 thuộc tính")
    private Set<UUID> optionValueIds;            // [uuid-đen, uuid-S]
}
```

> **Tại sao dùng `Set<UUID> optionValueIds` thay vì `List<String> optionValues`?**
>
> Plan cũ dùng string: `["Đen", "S"]` — sẽ lỗi nếu:
> - Typo: `"Đenn"` thay vì `"Đen"`.
> - Trùng tên giữa 2 group: group "Loại" có value "M" (Medium), group "Size" cũng có value "M".
>
> Plan mới dùng UUID: `[uuid-1, uuid-2]` — mỗi OptionValue có ID duy nhất, không bao giờ nhầm lẫn.

### 6.4 Response DTO

```java
@Getter @Setter @Builder
public class ProductOptionGroupResponse {
    private UUID id;
    private String name;
    private Integer sortOrder;
    private List<ProductOptionValueResponse> values;
}
```

```java
@Getter @Setter @Builder
public class ProductOptionValueResponse {
    private UUID id;
    private String value;
    private String displayName;
    private String colorHex;
}
```

```java
@Getter @Setter @Builder
public class ProductVariantResponse {
    private UUID id;
    private String sku;
    private BigDecimal price;
    private Integer stockQuantity;
    private Boolean active;
    private ProductImageResponse image;     // Ảnh riêng của variant (nullable)
    private List<SelectedOptionResponse> options; // Các option đã chọn
}
```

```java
// Thông tin option trong variant response
// VD: { groupName: "Màu sắc", value: "Đen" }
@Getter @Setter @Builder
public class SelectedOptionResponse {
    private UUID optionGroupId;
    private String groupName;
    private UUID optionValueId;
    private String value;
}
```

ProductResponse thêm:

```java
private ProductType productType;
private List<ProductOptionGroupResponse> optionGroups;
private List<ProductVariantResponse> variants;
```

---

## 7. Service boundary

### 7.1 OwnershipService — DRY helper

```java
package com.springboot.techmart.service;

import com.springboot.techmart.entity.Product;
import com.springboot.techmart.entity.Role;
import com.springboot.techmart.entity.User;
import com.springboot.techmart.exception.ForbiddenException;
import com.springboot.techmart.exception.ResourceNotFoundException;
import com.springboot.techmart.repository.UserRepository;
import com.springboot.techmart.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OwnershipService {

    private final UserRepository userRepository;

    /**
     * Kiểm tra user hiện tại có quyền thao tác product này không.
     * - ADMIN: luôn được phép.
     * - VENDOR: chỉ được phép nếu product thuộc shop của mình.
     */
    public void checkProductOwner(Product product) {
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        if (currentUser.getRole() == Role.ADMIN) {
            return; // Admin luôn được phép
        }

        // So sánh owner của shop (product.vendor) với user hiện tại
        if (!product.getVendor().getOwner().getId().equals(currentUserId)) {
            throw new ForbiddenException("Bạn không có quyền thao tác sản phẩm này");
        }
    }
}
```

Sau khi tạo `OwnershipService`, refactor `ProductServiceImpl` bỏ đoạn check ownership duplicate ở `UpdateProduct()` và `DeleteProduct()`, thay bằng:

```java
ownershipService.checkProductOwner(product);
```

### 7.2 ProductOptionService

```java
public interface ProductOptionService {
    ProductOptionGroupResponse createGroup(UUID productId, ProductOptionGroupRequest request);
    ProductOptionGroupResponse updateGroup(UUID productId, UUID groupId, ProductOptionGroupRequest request);
    void deleteGroup(UUID productId, UUID groupId);

    ProductOptionValueResponse addValue(UUID productId, UUID groupId, ProductOptionValueRequest request);
    ProductOptionValueResponse updateValue(UUID productId, UUID valueId, ProductOptionValueRequest request);
    void deleteValue(UUID productId, UUID valueId);
}
```

#### ProductOptionServiceImpl chi tiết:

```java
@Service
@RequiredArgsConstructor
public class ProductOptionServiceImpl implements ProductOptionService {

    private final ProductRepository productRepository;
    private final ProductOptionGroupRepository groupRepository;
    private final ProductOptionValueRepository valueRepository;
    private final OwnershipService ownershipService;
    private final ProductOptionMapper optionMapper;

    @Override
    @Transactional
    public ProductOptionGroupResponse createGroup(UUID productId, ProductOptionGroupRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm"));
        ownershipService.checkProductOwner(product);

        // Check trùng tên group trong cùng product
        if (groupRepository.existsByProductIdAndNameIgnoreCase(productId, request.getName())) {
            throw new BadRequestException("Nhóm thuộc tính '" + request.getName() + "' đã tồn tại");
        }

        // Đổi productType sang VARIABLE nếu đang là SIMPLE
        if (product.getProductType() == ProductType.SIMPLE) {
            product.setProductType(ProductType.VARIABLE);
            productRepository.save(product);
        }

        ProductOptionGroup group = new ProductOptionGroup();
        group.setProduct(product);
        group.setName(request.getName());
        group.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);

        groupRepository.save(group);
        return optionMapper.toGroupResponse(group);
    }

    @Override
    @Transactional
    public ProductOptionValueResponse addValue(UUID productId, UUID groupId, ProductOptionValueRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm"));
        ownershipService.checkProductOwner(product);

        ProductOptionGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhóm thuộc tính"));

        // Kiểm tra group thuộc đúng product
        if (!group.getProduct().getId().equals(productId)) {
            throw new BadRequestException("Nhóm thuộc tính không thuộc sản phẩm này");
        }

        ProductOptionValue value = new ProductOptionValue();
        value.setOptionGroup(group);
        value.setValue(request.getValue());
        value.setDisplayName(request.getDisplayName());
        value.setColorHex(request.getColorHex());
        value.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);

        valueRepository.save(value);
        return optionMapper.toValueResponse(value);
    }

    // updateGroup, deleteGroup, updateValue, deleteValue — tương tự pattern trên
    // ...
}
```

> **Kiến thức: Tại sao `createGroup` tự động chuyển `productType` sang `VARIABLE`?**
>
> Khi Vendor bắt đầu thêm option group vào product, điều đó có nghĩa product này sẽ có variant. Thay vì bắt Vendor phải gọi 1 API riêng để "chuyển loại product", ta tự động chuyển. Ngược lại, khi Vendor xóa hết option groups, ta có thể tự động chuyển về `SIMPLE`.

### 7.3 ProductVariantValidator

```java
package com.springboot.techmart.validator;

import com.springboot.techmart.dto.request.ProductVariantRequest;
import com.springboot.techmart.entity.*;
import com.springboot.techmart.exception.BadRequestException;
import com.springboot.techmart.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ProductVariantValidator {

    private final ProductVariantRepository variantRepository;

    /**
     * Validate tất cả business rules khi tạo variant mới.
     */
    public void validateCreate(
            Product product,
            ProductVariantRequest request,
            Set<ProductOptionValue> optionValues,
            ProductImage image
    ) {
        validateSkuNotDuplicate(product.getId(), request.getSku());
        validateOptionValuesBelongToProduct(product, optionValues);
        validateNoDuplicateOptionGroup(optionValues);
        validateNoDuplicateCombination(product, optionValues);
        validateImageBelongsToProduct(product, image);
    }

    // ======== PRIVATE VALIDATORS ========

    /**
     * Rule 1: SKU không trùng trong phạm vi product.
     *
     * Tại sao check trong phạm vi product mà không phải toàn hệ thống?
     * → Vì 2 shop khác nhau có thể trùng SKU (VD: cả 2 đều bán "AOTHUN-DEN-S").
     * → Nhưng trong 1 product, SKU phải unique để phân biệt variant.
     */
    private void validateSkuNotDuplicate(UUID productId, String sku) {
        if (variantRepository.existsByProductIdAndSkuIgnoreCase(productId, sku)) {
            throw new BadRequestException("SKU '" + sku + "' đã tồn tại trong sản phẩm này");
        }
    }

    /**
     * Rule 2: Tất cả option values phải thuộc đúng product.
     *
     * Tại sao cần check?
     * → Nếu không check, Vendor A có thể truyền optionValueId của Product B,
     *   tạo ra variant "lạ" nối với option của product khác → dữ liệu sai.
     */
    private void validateOptionValuesBelongToProduct(Product product, Set<ProductOptionValue> optionValues) {
        for (ProductOptionValue value : optionValues) {
            UUID valueProductId = value.getOptionGroup().getProduct().getId();
            if (!valueProductId.equals(product.getId())) {
                throw new BadRequestException(
                    "Giá trị '" + value.getValue() + "' không thuộc sản phẩm này");
            }
        }
    }

    /**
     * Rule 3: Không chọn 2 values cùng 1 option group.
     *
     * VD Sai: Variant có "Đen" + "Trắng" (cả 2 đều thuộc group "Màu sắc")
     * → Một cái áo không thể vừa đen vừa trắng.
     *
     * VD Đúng: Variant có "Đen" (group Màu) + "S" (group Size)
     */
    private void validateNoDuplicateOptionGroup(Set<ProductOptionValue> optionValues) {
        Set<UUID> groupIds = new HashSet<>();
        for (ProductOptionValue value : optionValues) {
            UUID groupId = value.getOptionGroup().getId();
            if (!groupIds.add(groupId)) {
                throw new BadRequestException(
                    "Không thể chọn 2 giá trị trong cùng nhóm '" + value.getOptionGroup().getName() + "'");
            }
        }
    }

    /**
     * Rule 4: Không trùng tổ hợp option values với variant đã tồn tại.
     *
     * VD: Đã có variant "Đen + S". Không được tạo thêm variant "Đen + S" nữa
     * (dù SKU khác nhau).
     *
     * Cách check: So sánh SET các optionValueId.
     */
    private void validateNoDuplicateCombination(Product product, Set<ProductOptionValue> newValues) {
        Set<UUID> newValueIds = newValues.stream()
                .map(ProductOptionValue::getId)
                .collect(Collectors.toSet());

        for (ProductVariant existingVariant : product.getVariants()) {
            Set<UUID> existingValueIds = existingVariant.getOptionValues().stream()
                    .map(ProductOptionValue::getId)
                    .collect(Collectors.toSet());

            if (existingValueIds.equals(newValueIds)) {
                throw new BadRequestException("Đã tồn tại biến thể với cùng tổ hợp thuộc tính này");
            }
        }
    }

    /**
     * Rule 5: Image nếu có phải thuộc đúng product.
     *
     * Tại sao? → Tránh Vendor A lấy ảnh từ Product B gán vào variant của Product A.
     */
    private void validateImageBelongsToProduct(Product product, ProductImage image) {
        if (image != null && !image.getProduct().getId().equals(product.getId())) {
            throw new BadRequestException("Ảnh không thuộc sản phẩm này");
        }
    }
}
```

### 7.4 ProductVariantService

```java
public interface ProductVariantService {
    ProductVariantResponse createVariant(UUID productId, ProductVariantRequest request);
    ProductVariantResponse updateVariant(UUID productId, UUID variantId, ProductVariantRequest request);
    void deactivateVariant(UUID productId, UUID variantId);
    void deleteVariant(UUID productId, UUID variantId);
}
```

#### ProductVariantServiceImpl chi tiết:

```java
@Service
@RequiredArgsConstructor
public class ProductVariantServiceImpl implements ProductVariantService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final ProductOptionValueRepository optionValueRepository;
    private final ProductImageRepository imageRepository;
    private final OwnershipService ownershipService;
    private final ProductVariantValidator validator;
    private final ProductVariantMapper variantMapper;
    private final ProductVariantSyncService syncService;

    @Override
    @Transactional
    public ProductVariantResponse createVariant(UUID productId, ProductVariantRequest request) {
        // 1. Load product
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm"));

        // 2. Check ownership
        ownershipService.checkProductOwner(product);

        // 3. Load option values từ DB (1 câu query, tránh N+1)
        Set<ProductOptionValue> optionValues = new HashSet<>(
                optionValueRepository.findByIdIn(request.getOptionValueIds()));

        if (optionValues.size() != request.getOptionValueIds().size()) {
            throw new BadRequestException("Một hoặc nhiều giá trị thuộc tính không tồn tại");
        }

        // 4. Load image nếu có
        ProductImage image = null;
        if (request.getImageId() != null) {
            image = imageRepository.findById(request.getImageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ảnh"));
        }

        // 5. Validate business rules
        validator.validateCreate(product, request, optionValues, image);

        // 6. Build entity
        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku(request.getSku());
        variant.setPrice(request.getPrice());
        variant.setStockQuantity(request.getStockQuantity());
        variant.setActive(request.getActive() != null ? request.getActive() : true);
        variant.setImage(image);
        variant.setOptionValues(optionValues);

        // 7. Save
        variantRepository.save(variant);

        // 8. Sync product summary (min price, total stock)
        syncService.syncProductSummary(product);

        // 9. Map response
        return variantMapper.toResponse(variant);
    }

    // updateVariant, deactivateVariant, deleteVariant — tương tự pattern trên
    // ...
}
```

### 7.5 ProductVariantSyncService

```java
public interface ProductVariantSyncService {
    void syncProductSummary(Product product);
}
```

```java
@Service
@RequiredArgsConstructor
public class ProductVariantSyncServiceImpl implements ProductVariantSyncService {

    private final ProductVariantRepository variantRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void syncProductSummary(Product product) {
        List<ProductVariant> activeVariants = variantRepository
                .findByProductIdAndActiveTrue(product.getId());

        if (activeVariants.isEmpty()) {
            // Không còn variant active → stock = 0, giữ nguyên price
            product.setStockQuantity(0);
        } else {
            // price = giá thấp nhất (Frontend hiển thị "Từ 180.000đ")
            BigDecimal minPrice = activeVariants.stream()
                    .map(ProductVariant::getPrice)
                    .min(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);

            // stockQuantity = tổng tồn kho tất cả active variants
            int totalStock = activeVariants.stream()
                    .mapToInt(ProductVariant::getStockQuantity)
                    .sum();

            product.setPrice(minPrice);
            product.setStockQuantity(totalStock);
        }

        productRepository.save(product);
    }
}
```

> **Kiến thức: Khi nào cần gọi `syncProductSummary`?**
>
> | Hành động | Cần sync? | Lý do |
> |:----------|:----------|:------|
> | Tạo variant | ✅ | Giá min hoặc tổng stock thay đổi |
> | Sửa giá/stock variant | ✅ | Giá min hoặc tổng stock thay đổi |
> | Activate/Deactivate variant | ✅ | Variant bị tắt → giá min hoặc stock thay đổi |
> | Xóa variant | ✅ | Giống deactivate |
> | Checkout (trừ stock variant) | ✅ | Tổng stock giảm |
> | Cancel order (hoàn stock variant) | ✅ | Tổng stock tăng |
>
> Nếu quên gọi ở bất kỳ chỗ nào, dữ liệu Product.price/stockQuantity sẽ lệch với thực tế.

---

## 8. API design

### 8.1 Product (giữ nguyên)

```text
POST   /api/products
GET    /api/products/{productId}
PUT    /api/products/{productId}
DELETE /api/products/{productId}
GET    /api/products/search
```

### 8.2 Option groups and values

```text
POST   /api/products/{productId}/option-groups
PUT    /api/products/{productId}/option-groups/{groupId}
DELETE /api/products/{productId}/option-groups/{groupId}

POST   /api/products/{productId}/option-groups/{groupId}/values
PUT    /api/products/{productId}/option-values/{valueId}
DELETE /api/products/{productId}/option-values/{valueId}
```

Authorization: `@PreAuthorize("hasAnyRole('VENDOR', 'ADMIN')")` + ownership check trong Service.

### 8.3 Variants

```text
POST   /api/products/{productId}/variants
GET    /api/products/{productId}/variants
PUT    /api/products/{productId}/variants/{variantId}
PATCH  /api/products/{productId}/variants/{variantId}/deactivate
DELETE /api/products/{productId}/variants/{variantId}
```

Authorization: tương tự option groups.

### 8.4 Cart

`CartItemRequest` thêm:

```java
private UUID variantId;  // null cho SIMPLE product
```

Rules:
- Product SIMPLE: `variantId` phải null. Nếu gửi kèm variantId → báo lỗi.
- Product VARIABLE: `variantId` bắt buộc. Nếu thiếu → báo lỗi.
- Nếu variant không thuộc product → báo lỗi.

---

## 9. Cart và Order refactor

### 9.1 CartService — addToCart hỗ trợ Variant

```java
@Override
@Transactional
public CartResponse addToCart(UUID userId, CartItemRequest itemRequest) {
    Cart cart = getOrCreate(userId);
    Product product = productRepository.findById(itemRequest.getProductId())
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy sản phẩm"));

    ProductVariant variant = null;

    if (product.getProductType() == ProductType.VARIABLE) {
        // VARIABLE product → BẮT BUỘC có variantId
        if (itemRequest.getVariantId() == null) {
            throw new BadRequestException("Vui lòng chọn phân loại hàng");
        }
        variant = variantRepository.findById(itemRequest.getVariantId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy biến thể"));

        if (!variant.getProduct().getId().equals(product.getId())) {
            throw new BadRequestException("Biến thể không thuộc sản phẩm này");
        }
        if (!variant.getActive()) {
            throw new BadRequestException("Biến thể này đã ngừng bán");
        }
    } else {
        // SIMPLE product → KHÔNG được gửi variantId
        if (itemRequest.getVariantId() != null) {
            throw new BadRequestException("Sản phẩm này không có phân loại hàng");
        }
    }

    // Lấy giá và tồn kho đúng
    BigDecimal unitPrice = resolveUnitPrice(product, variant);
    int availableStock = resolveAvailableStock(product, variant);

    if (itemRequest.getQuantity() > availableStock) {
        throw new BadRequestException("Số lượng sản phẩm không đủ trong kho");
    }

    // Check duplicate trong giỏ hàng
    Optional<CartItem> existing = findExistingCartItem(cart, product.getId(), variant);
    if (existing.isPresent()) {
        CartItem item = existing.get();
        int newQty = item.getQuantity() + itemRequest.getQuantity();
        if (newQty > availableStock) {
            throw new BadRequestException("Tổng số lượng vượt quá tồn kho");
        }
        item.setQuantity(newQty);
    } else {
        CartItem newItem = new CartItem();
        newItem.setCart(cart);
        newItem.setProduct(product);
        newItem.setVariant(variant);
        newItem.setQuantity(itemRequest.getQuantity());
        cart.getItems().add(newItem);
    }

    cartRepository.save(cart);
    return getCart(userId);
}

// ======== HELPER ========

private BigDecimal resolveUnitPrice(Product product, ProductVariant variant) {
    return variant != null ? variant.getPrice() : product.getPrice();
}

private int resolveAvailableStock(Product product, ProductVariant variant) {
    return variant != null ? variant.getStockQuantity() : product.getStockQuantity();
}

private Optional<CartItem> findExistingCartItem(Cart cart, UUID productId, ProductVariant variant) {
    return cart.getItems().stream()
            .filter(item -> {
                boolean sameProduct = item.getProduct().getId().equals(productId);
                if (variant == null) {
                    return sameProduct && item.getVariant() == null;
                }
                return sameProduct && item.getVariant() != null
                        && item.getVariant().getId().equals(variant.getId());
            })
            .findFirst();
}
```

### 9.2 OrderService — Checkout hỗ trợ Variant

Những chỗ cần sửa trong `OrderServiceImpl.checkOut()`:

```java
// THAY ĐỔI 1: Lấy giá từ đúng nguồn
for (CartItem item : cart.getItems()) {
    Product product = item.getProduct();
    ProductVariant variant = item.getVariant();

    // Lấy giá đúng
    BigDecimal unitPrice = variant != null ? variant.getPrice() : product.getPrice();

    // Kiểm tra tồn kho đúng
    int availableStock = variant != null ? variant.getStockQuantity() : product.getStockQuantity();
    if (availableStock < item.getQuantity()) {
        throw new BadRequestException("Sản phẩm " + product.getName() + " không đủ hàng tồn kho");
    }

    totalAmount = totalAmount.add(unitPrice.multiply(BigDecimal.valueOf(item.getQuantity())));
}

// THAY ĐỔI 2: Trừ tồn kho đúng chỗ + Snapshot thông tin variant
for (CartItem item : cart.getItems()) {
    Product product = item.getProduct();
    ProductVariant variant = item.getVariant();

    // Trừ tồn kho
    if (variant != null) {
        variant.setStockQuantity(variant.getStockQuantity() - item.getQuantity());
        variantRepository.save(variant);
    } else {
        product.setStockQuantity(product.getStockQuantity() - item.getQuantity());
        productRepository.save(product);
    }

    // Build OrderItem VỚI SNAPSHOT
    BigDecimal unitPrice = variant != null ? variant.getPrice() : product.getPrice();
    OrderItem orderItem = OrderItem.builder()
            .order(order)
            .product(product)
            .variant(variant)
            .quantity(item.getQuantity())
            .priceAtPurchase(unitPrice)
            // === SNAPSHOT FIELDS ===
            .productNameAtPurchase(product.getName())
            .variantSkuAtPurchase(variant != null ? variant.getSku() : null)
            .selectedOptions(buildSelectedOptionsText(variant))
            .thumbnailUrl(resolveImageUrl(product, variant))
            .build();
    orderItems.add(orderItem);
}

// THAY ĐỔI 3: Sync product summary cho mọi variable product
Set<UUID> syncedProductIds = new HashSet<>();
for (CartItem item : cart.getItems()) {
    if (item.getVariant() != null && syncedProductIds.add(item.getProduct().getId())) {
        syncService.syncProductSummary(item.getProduct());
    }
}
```

Helper methods:

```java
private String buildSelectedOptionsText(ProductVariant variant) {
    if (variant == null) return null;
    // VD: "Color: Đen, Size: S"
    return variant.getOptionValues().stream()
            .map(v -> v.getOptionGroup().getName() + ": " + v.getValue())
            .collect(Collectors.joining(", "));
}

private String resolveImageUrl(Product product, ProductVariant variant) {
    // Ưu tiên: variant image → product primary image → product first image
    if (variant != null && variant.getImage() != null) {
        return variant.getImage().getImageUrl();
    }
    if (product.getProductImages() != null && !product.getProductImages().isEmpty()) {
        return product.getProductImages().stream()
                .filter(img -> Boolean.TRUE.equals(img.getIsPrimary()))
                .findFirst()
                .map(ProductImage::getImageUrl)
                .orElse(product.getProductImages().get(0).getImageUrl());
    }
    return null;
}
```

### 9.3 Cancel Order — Hoàn tồn kho đúng chỗ

```java
// Sửa trong cancelOrder():
for (OrderItem item : order.getItems()) {
    if (item.getVariant() != null) {
        ProductVariant variant = item.getVariant();
        variant.setStockQuantity(variant.getStockQuantity() + item.getQuantity());
        variantRepository.save(variant);
    } else {
        Product product = item.getProduct();
        product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
        productRepository.save(product);
    }
}

// Sync summary cho mọi variable product
Set<UUID> syncedProductIds = new HashSet<>();
for (OrderItem item : order.getItems()) {
    if (item.getVariant() != null && syncedProductIds.add(item.getProduct().getId())) {
        syncService.syncProductSummary(item.getProduct());
    }
}
```

---

## 10. Mapper chi tiết

### ProductVariantMapper

```java
@Component
@RequiredArgsConstructor
public class ProductVariantMapper {

    public ProductVariantResponse toResponse(ProductVariant variant) {
        // Map option values → SelectedOptionResponse
        List<SelectedOptionResponse> options = variant.getOptionValues().stream()
                .map(v -> SelectedOptionResponse.builder()
                        .optionGroupId(v.getOptionGroup().getId())
                        .groupName(v.getOptionGroup().getName())
                        .optionValueId(v.getId())
                        .value(v.getValue())
                        .build())
                .toList();

        // Map variant image
        ProductImageResponse imageResponse = null;
        if (variant.getImage() != null) {
            imageResponse = ProductImageResponse.fromEntity(variant.getImage());
        }

        return ProductVariantResponse.builder()
                .id(variant.getId())
                .sku(variant.getSku())
                .price(variant.getPrice())
                .stockQuantity(variant.getStockQuantity())
                .active(variant.getActive())
                .image(imageResponse)
                .options(options)
                .build();
    }
}
```

### ProductOptionMapper

```java
@Component
public class ProductOptionMapper {

    public ProductOptionGroupResponse toGroupResponse(ProductOptionGroup group) {
        List<ProductOptionValueResponse> valueResponses = group.getValues().stream()
                .map(this::toValueResponse)
                .toList();

        return ProductOptionGroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .sortOrder(group.getSortOrder())
                .values(valueResponses)
                .build();
    }

    public ProductOptionValueResponse toValueResponse(ProductOptionValue value) {
        return ProductOptionValueResponse.builder()
                .id(value.getId())
                .value(value.getValue())
                .displayName(value.getDisplayName())
                .colorHex(value.getColorHex())
                .build();
    }
}
```

---

## 11. Thứ tự implement để ít vỡ code

### Step 1: Mapper + OwnershipService
- Tạo package `mapper/`.
- Chuyển `ProductResponse.fromEntity()` sang `ProductMapper.toResponse()`.
- Chuyển `CartItemResponse.toDto()` sang `CartItemMapper.toResponse()`.
- Chuyển `OrderItemResponse.toDto()` sang `OrderItemMapper.toResponse()`.
- Tạo `OwnershipService`.
- Refactor `ProductServiceImpl` dùng `ProductMapper` và `OwnershipService`.
- **Test: Mọi API cũ vẫn hoạt động bình thường.**

### Step 2: Entity + Repository
- Tạo `ProductType` enum.
- Thêm `productType` vào `Product`.
- Tạo `ProductOptionGroup`, `ProductOptionValue`, `ProductVariant`.
- Tạo 3 repository mới.
- **Test: Khởi động ứng dụng thành công, JPA tạo bảng mới.**

### Step 3: DTO + Mapper cho Option/Variant
- Tạo request/response DTO cho option và variant.
- Tạo `ProductOptionMapper` và `ProductVariantMapper`.

### Step 4: ProductOptionService + Controller
- Tạo/sửa/xóa option group.
- Tạo/sửa/xóa option value.
- Check ownership.
- **Test: CRUD option groups/values qua Swagger.**

### Step 5: ProductVariantValidator + ProductVariantService + Controller
- Tạo `ProductVariantValidator`.
- Tạo `ProductVariantService` + `ProductVariantSyncService`.
- Tạo `ProductVariantController`.
- **Test: Tạo variant thành công, test từng rule trong validator.**

### Step 6: ProductResponse detail
- Cập nhật `ProductMapper`: Product detail trả về images, optionGroups, variants.
- Search/list product chỉ trả thumbnail + min price + stock summary (không cần full variants).
- **Test: GET /api/products/{id} trả về đầy đủ options + variants.**

### Step 7: Cart refactor
- Thêm `variantId` vào `CartItemRequest`.
- Thêm `variant` vào `CartItem`.
- Sửa `CartServiceImpl.addToCart()`, `updateCartItem()`, `deleteCartItem()`.
- Sửa `CartItemMapper`.
- **Test: Add SIMPLE product (không variantId). Add VARIABLE product (có variantId). Test lỗi khi thiếu variantId.**

### Step 8: Order refactor
- Thêm snapshot fields vào `OrderItem`.
- Sửa `OrderServiceImpl.checkOut()`: trừ stock variant, snapshot fields.
- Sửa `OrderServiceImpl.cancelOrder()`: hoàn stock variant.
- Sửa `OrderItemMapper` ưu tiên snapshot fields.
- **Test: Checkout → stock variant giảm. Cancel → stock variant tăng lại. Đơn cũ vẫn hiển thị đúng.**

### Step 9: Tests tổng hợp
- Test product SIMPLE vẫn hoạt động bình thường (backward compatible).
- Test tạo option group + value.
- Test tạo variant thành công.
- Test SKU duplicate → lỗi.
- Test option value không thuộc product → lỗi.
- Test 2 values cùng option group → lỗi.
- Test duplicate combination → lỗi.
- Test imageId không thuộc product → lỗi.
- Test add cart VARIABLE không có variantId → lỗi.
- Test checkout trừ stock variant.
- Test cancel hoàn stock variant.

---

## 12. Checklist hoàn thành

- [ ] Tạo `ProductType`.
- [ ] Thêm `productType`, `optionGroups`, `variants` vào Product.
- [ ] Tạo `ProductOptionGroup`.
- [ ] Tạo `ProductOptionValue`.
- [ ] Tạo `ProductVariant`.
- [ ] Tạo repositories.
- [ ] Tạo DTO option/variant.
- [ ] Tạo mapper option/variant/product/cart/order.
- [ ] Tạo `OwnershipService`.
- [ ] Tạo `ProductOptionService` + Controller.
- [ ] Tạo `ProductVariantValidator`.
- [ ] Tạo `ProductVariantService` + Controller.
- [ ] Tạo `ProductVariantSyncService`.
- [ ] Cập nhật `ProductResponse` (qua ProductMapper).
- [ ] Cập nhật `CartItemRequest`, `CartItem`, `CartService`, `CartItemResponse`.
- [ ] Cập nhật `OrderItem`, `OrderService`, `OrderItemResponse`.
- [ ] Thêm tests cho business rules quan trọng.

---

## 13. Những việc KHÔNG LÀM trong phase này

Để phase không bị quá lớn, tạm thời chưa làm:

- Discount/voucher theo variant.
- Bulk import variants từ Excel.
- Auto generate tất cả variant combinations.
- Multiple shops per user.
- Inventory reservation/hold stock.

Nhưng design hiện tại sẽ không chặn các phase đó.

---

## 14. Kiến thức tổng hợp sau Phase

| Kiến thức | Giải thích |
|:----------|:-----------|
| `@ManyToMany` + `@JoinTable` | Quan hệ N:N với bảng trung gian, owning side vs inverse side |
| `@UniqueConstraint` composite | Chống dữ liệu trùng ở cấp database (tuyến phòng thủ cuối) |
| NULL trong Unique Constraint | PostgreSQL: NULL != NULL, cần partial unique index |
| Mapper Pattern | Tách logic chuyển đổi DTO khỏi Entity, giảm coupling |
| Validator Pattern | Tách business rules khỏi Service, dễ test, dễ reuse |
| Ownership Service | DRY helper cho kiểm tra quyền sở hữu |
| Snapshot Data | Lưu thừa thông tin trong OrderItem để bảo toàn lịch sử |
| Sync Service | Đồng bộ dữ liệu tổng hợp (min price, total stock) sau mỗi thay đổi |
| `Set` vs `List` trong `@ManyToMany` | `Set` hiệu quả hơn với Hibernate (tránh delete-all-then-reinsert) |
| `findByIdIn(Collection)` | Batch load entities thay vì N+1 trong vòng lặp |
| Service boundary / Separation of Concerns | Mỗi Service lo đúng nghiệp vụ của nó |
| `CascadeType.ALL` + `orphanRemoval` | Khi save cha → tự save con, khi xóa con khỏi list → DB xóa record |

---

## 15. Từ khóa tìm hiểu

```
JPA @ManyToMany @JoinTable bidirectional
Hibernate Set vs List ManyToMany performance
PostgreSQL partial unique index NULL constraint
Mapper Pattern Spring Boot manual vs MapStruct
Domain validation vs Bean validation Spring
Separation of Concerns service layer design
Snapshot data pattern e-commerce order history
Spring @Transactional propagation service-to-service
Optimistic Locking @Version concurrent stock update
Spring Boot JPA batch insert findByIdIn
```
