# Ke hoach trien khai: Product Options & Variants

Phase nay nang cap Product tu dang don gian "1 product = 1 gia, 1 ton kho" thanh he thong co phan loai san pham:

- Product cha: thong tin chung, category, shop/vendor, gallery anh.
- Option group: nhom lua chon nhu Color, Storage, Size.
- Option value: gia tri lua chon nhu Black, Blue, 128GB, XL.
- Variant: SKU ban duoc, co gia rieng, ton kho rieng, trang thai active va anh rieng tuy chon.

Trong phase nay, muc tieu refactor khong phai la "dung Factory Pattern cho bang duoc". Huong dung hon la:

- Service tach dung boundary nghiep vu.
- Validator/Policy gom business rules.
- Mapper tach DTO mapping khoi service/entity.
- Factory chi dung neu can build entity phuc tap, khong goi repository trong factory.
- Resolver/helper giup Cart/Order lay dung price, stock, image theo variant hoac product.

---

## 1. Muc tieu nghiep vu

### 1.1 Hien tai

```text
Product
- name
- description
- price
- stockQuantity
- productImages

CartItem / OrderItem chi tro toi productId.
```

### 1.2 Sau phase nay

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

Quy tac:

- Product khong co variants van hoat dong nhu hien tai.
- Product co variants thi Cart/Checkout bat buoc chon `variantId`.
- Gia va ton kho uu tien lay tu variant.
- Anh hien thi uu tien lay tu variant image, neu khong co thi fallback ve product primary image.
- OrderItem phai snapshot thong tin variant de lich su don hang khong bi doi khi vendor sua product.

---

## 2. Pattern ap dung trong phase nay

### 2.1 Mapper Pattern

Khong nen de `ProductResponse.fromEntity()`, `CartItemResponse.toDto()`, `OrderItemResponse.toDto()` phinh to.

Tao package:

```text
mapper/
  ProductMapper.java
  ProductImageMapper.java
  ProductOptionMapper.java  
  ProductVariantMapper.java
  CartItemMapper.java
  OrderItemMapper.java
```

Vi du:

```java
@Component
public class ProductVariantMapper {
    public ProductVariantResponse toResponse(ProductVariant variant) {
        // map id, sku, price, stock, image, selected options
    }
}
```

Service chi lo nghiep vu, mapper lo response.

### 2.2 Validator / Policy Pattern

Variant co nhieu rule, nen khong nen nhung het vao service.

Tao package:

```text
validator/
  ProductVariantValidator.java
  ProductOptionValidator.java
```

`ProductVariantValidator` can kiem tra:

- SKU khong trung trong pham vi product hoac shop.
- Option values phai thuoc dung product.
- Moi variant khong duoc chon 2 values trong cung 1 option group.
- Khong duoc tao 2 variants co cung to hop option values.
- Image neu co phai thuoc dung product.
- Khi update/delete variant, khong lam product roi vao trang thai khong hop le.

Vi du:

```java
@Component
public class ProductVariantValidator {
    public void validateCreate(
            Product product,
            ProductVariantRequest request,
            Set<ProductOptionValue> optionValues,
            ProductImage image
    ) {
        validateOptionValuesBelongToProduct(product, optionValues);
        validateNoDuplicateOptionGroup(optionValues);
        validateNoDuplicateCombination(product, optionValues);
        validateImageBelongsToProduct(product, image);
    }
}
```

### 2.3 Factory Pattern chi la optional

Factory co the dung de build entity, nhung khong nen:

- Goi repository.
- Check ownership.
- Save database.
- Dieu phoi transaction.

Dung factory nhe:

```java
@Component
public class ProductVariantFactory {
    public ProductVariant create(
            Product product,
            ProductVariantRequest request,
            ProductImage image,
            Set<ProductOptionValue> optionValues
    ) {
        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku(request.getSku());
        variant.setPrice(request.getPrice());
        variant.setStockQuantity(request.getStockQuantity());
        variant.setImage(image);
        variant.setActive(request.getActive() != null ? request.getActive() : true);
        variant.setOptionValues(optionValues);
        return variant;
    }
}
```

Neu service chua qua dai, co the chua can factory trong phase dau.

### 2.4 Resolver / Helper cho Cart va Order

Cart/Order can lay dung gia, ton kho, anh:

```java
@Component
public class PurchasableResolver {
    public Purchasable resolve(UUID productId, UUID variantId) {
        // validate product, variant va tra ve object co price/stock/image
    }
}
```

Phase dau co the lam helper trong service. Khi logic phinh, tach thanh resolver.

---

## 3. Entity design

### 3.1 Product

Giữ `price` và `stockQuantity` để backward compatible:

- Product không có variants: `price`, `stockQuantity` là giá/tồn kho thật.
- Product có variants: `price` có thể là min price, `stockQuantity` là tổng tồn kho active variants.

Them field:

```java
@Enumerated(EnumType.STRING)
@Column(name = "product_type", nullable = false)
private ProductType productType = ProductType.SIMPLE;

@OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
@OrderBy("sortOrder ASC")
private List<ProductOptionGroup> optionGroups = new ArrayList<>();

@OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
private List<ProductVariant> variants = new ArrayList<>();
```

Enum:

```java
public enum ProductType {
    SIMPLE,
    VARIABLE
}
```

### 3.2 ProductOptionGroup

```java
@Entity
@Table(
    name = "product_option_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "name"})
)
public class ProductOptionGroup extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String name; // Color, Storage, Size

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @OneToMany(mappedBy = "optionGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductOptionValue> values = new ArrayList<>();
}
```

### 3.3 ProductOptionValue

```java
@Entity
@Table(
    name = "product_option_values",
    uniqueConstraints = @UniqueConstraint(columnNames = {"option_group_id", "value"})
)
public class ProductOptionValue extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_group_id", nullable = false)
    private ProductOptionGroup optionGroup;

    @Column(nullable = false)
    private String value; // Black, Blue, 128GB

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "color_hex")
    private String colorHex;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
```

### 3.4 ProductVariant

Khong luu `imageUrl` string. Dung lien ket toi `ProductImage`.

```java
@Entity
@Table(
    name = "product_variants",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "sku"})
)
public class ProductVariant extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(name = "stock_quantity", nullable = false)
    private Integer stockQuantity;

    @Column(nullable = false)
    private Boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_id")
    private ProductImage image;

    @ManyToMany
    @JoinTable(
        name = "product_variant_option_values",
        joinColumns = @JoinColumn(name = "variant_id"),
        inverseJoinColumns = @JoinColumn(name = "option_value_id")
    )
    private Set<ProductOptionValue> optionValues = new HashSet<>();

    @Version
    private Long version;
}
```

### 3.5 CartItem

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "variant_id")
private ProductVariant variant;
```

Luu y unique constraint:

`UNIQUE(cart_id, product_id, variant_id)` co the khong chan duplicate neu `variant_id` la `NULL` tuy database. Vi vay:

- Service phai check duplicate simple product bang `(cartId, productId, variantId null)`.
- Variant product check duplicate bang `(cartId, productId, variantId)`.

### 3.6 OrderItem

Them snapshot:

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "variant_id")
private ProductVariant variant;

@Column(name = "product_name_at_purchase")
private String productNameAtPurchase;

@Column(name = "variant_sku_at_purchase")
private String variantSkuAtPurchase;

@Column(name = "selected_options", columnDefinition = "TEXT")
private String selectedOptions; // JSON/text snapshot

@Column(name = "thumbnail_url")
private String thumbnailUrl;
```

Snapshot nay quan trong vi vendor co the sua/xoa variant sau khi order da tao.

---

## 4. Repository

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

Duplicate option combination nen check trong validator bang cach load variants cua product va so sanh set option value ids.

---

## 5. DTO design

### 5.1 ProductRequest

Khong nhan images va khong nhan variants trong request tao product co ban.

```java
public class ProductRequest {
    private String name;
    private String description;
    private BigDecimal price;
    private Integer stockQuantity;
    private UUID categoryId;
}
```

Sau nay neu can tao product + variants trong mot request cho admin tool thi tao DTO rieng, khong tron vao `ProductRequest` co ban.

### 5.2 Option DTO

```java
public class ProductOptionGroupRequest {
    private String name;
    private Integer sortOrder;
}

public class ProductOptionValueRequest {
    private String value;
    private String displayName;
    private String colorHex;
    private Integer sortOrder;
}
```

### 5.3 Variant DTO

```java
public class ProductVariantRequest {
    private String sku;
    private BigDecimal price;
    private Integer stockQuantity;
    private Boolean active;
    private UUID imageId;
    private Set<UUID> optionValueIds;
}
```

Dung `optionValueIds`, khong dung string values. Ly do:

- Tranh trung ten value giua cac group.
- Tranh typo.
- De validate value thuoc product.

### 5.4 Response DTO

```java
public class ProductVariantResponse {
    private UUID id;
    private String sku;
    private BigDecimal price;
    private Integer stockQuantity;
    private Boolean active;
    private ProductImageResponse image;
    private List<SelectedOptionResponse> options;
}

public class SelectedOptionResponse {
    private UUID optionGroupId;
    private String groupName;
    private UUID optionValueId;
    private String value;
}
```

Product detail response them:

```java
private ProductType productType;
private List<ProductOptionGroupResponse> optionGroups;
private List<ProductVariantResponse> variants;
```

---

## 6. Service boundary

### 6.1 ProductService

Chi quan ly product cha:

- create product.
- update name/description/price/stock/category cho simple product.
- delete product.
- get/search product.

Khong nen tao option/variant trong `ProductServiceImpl.createProduct()`.

### 6.2 ProductOptionService

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

### 6.3 ProductVariantService

```java
public interface ProductVariantService {
    ProductVariantResponse createVariant(UUID productId, ProductVariantRequest request);
    ProductVariantResponse updateVariant(UUID productId, UUID variantId, ProductVariantRequest request);
    void deactivateVariant(UUID productId, UUID variantId);
    void deleteVariant(UUID productId, UUID variantId);
}
```

Service flow:

```java
@Transactional
public ProductVariantResponse createVariant(UUID productId, ProductVariantRequest request) {
    Product product = getProductOrThrow(productId);
    ownershipService.checkProductOwner(product);

    Set<ProductOptionValue> values = loadOptionValues(request.getOptionValueIds());
    ProductImage image = loadImageIfPresent(request.getImageId());

    validator.validateCreate(product, request, values, image);

    ProductVariant variant = factory.create(product, request, image, values);
    productVariantRepository.save(variant);

    productVariantSyncService.syncProductSummary(product);

    return productVariantMapper.toResponse(variant);
}
```

### 6.4 ProductVariantSyncService

Neu `Product.price` va `Product.stockQuantity` duoc dung lam summary cho variable product, can sync moi khi:

- create variant.
- update price/stock.
- activate/deactivate variant.
- delete variant.
- checkout tru stock variant.
- cancel/refund cong stock variant.

```java
public interface ProductVariantSyncService {
    void syncProductSummary(Product product);
}
```

Logic:

- `product.price = min(active variant price)`.
- `product.stockQuantity = sum(active variant stockQuantity)`.
- Neu khong con active variant, stock = 0.

---

## 7. API design

### 7.1 Product

```text
POST   /api/products
GET    /api/products/{productId}
PUT    /api/products/{productId}
DELETE /api/products/{productId}
```

### 7.2 Option groups and values

```text
POST   /api/products/{productId}/option-groups
PUT    /api/products/{productId}/option-groups/{groupId}
DELETE /api/products/{productId}/option-groups/{groupId}

POST   /api/products/{productId}/option-groups/{groupId}/values
PUT    /api/products/{productId}/option-values/{valueId}
DELETE /api/products/{productId}/option-values/{valueId}
```

### 7.3 Variants

```text
POST   /api/products/{productId}/variants
GET    /api/products/{productId}/variants
PUT    /api/products/{productId}/variants/{variantId}
PATCH  /api/products/{productId}/variants/{variantId}/deactivate
DELETE /api/products/{productId}/variants/{variantId}
```

### 7.4 Cart

`CartItemRequest` them:

```java
private UUID variantId;
```

Rules:

- Product SIMPLE: `variantId` null.
- Product VARIABLE: `variantId` bat buoc.
- Neu request gui variantId cho product SIMPLE thi bao loi.
- Neu variant khong thuoc product thi bao loi.

---

## 8. Cart va Order refactor

### 8.1 CartService

Can xu ly:

- Tim product.
- Neu product co variants thi bat buoc variantId.
- Load variant va validate thuoc product.
- Check stock theo variant hoac product.
- Neu item da ton tai trong cart thi cong quantity.
- Tinh response price/subtotal theo variant neu co.

Nen them helper:

```java
private BigDecimal resolveUnitPrice(Product product, ProductVariant variant) {
    return variant != null ? variant.getPrice() : product.getPrice();
}

private int resolveAvailableStock(Product product, ProductVariant variant) {
    return variant != null ? variant.getStockQuantity() : product.getStockQuantity();
}
```

Sau nay co discount/voucher thi tach thanh `PriceResolver`.

### 8.2 OrderService

Checkout can:

- Dung cart items da co variant.
- Tru stock variant neu cart item co variant.
- Tru stock product neu simple product.
- Snapshot product name, sku, selected options, thumbnail, price.
- Sau khi tru stock variant, sync summary product.

OrderItem response khong nen phu thuoc vao Product/Variant hien tai. Uu tien snapshot fields.

---

## 9. Ownership va authorization

Moi API option/variant can:

```java
@PreAuthorize("hasAnyRole('VENDOR', 'ADMIN')")
```

Trong service van phai check ownership:

- ADMIN duoc thao tac moi product.
- VENDOR chi thao tac product thuoc shop cua minh.

Nen tach helper:

```java
@Component
public class OwnershipService {
    public void checkProductOwner(Product product) {
        // current user admin OR current user's shop owns product
    }
}
```

Khong nen copy `checkOwnership()` trong tung service.

---

## 10. Thu tu implement de it vo code

### Step 1: Mapper + ownership helper

- Tao mapper package.
- Chuyen `ProductResponse.fromEntity`, `CartItemResponse.toDto`, `OrderItemResponse.toDto` dan sang mapper.
- Tao `OwnershipService`.

### Step 2: Entity + repository

- Tao `ProductType`.
- Them `productType` vao Product.
- Tao `ProductOptionGroup`, `ProductOptionValue`, `ProductVariant`.
- Tao repositories.

### Step 3: DTO + mapper

- Tao request/response DTO cho option va variant.
- Tao mapper cho option/variant.

### Step 4: Option service/controller

- Tao/sua/xoa option group.
- Tao/sua/xoa option value.
- Check ownership.

### Step 5: Variant validator/service/controller

- Tao `ProductVariantValidator`.
- Tao `ProductVariantService`.
- Tao `ProductVariantController`.
- Sync product summary.

### Step 6: ProductResponse detail

- Product detail tra ve images, optionGroups, variants.
- Search/list product co the chi tra thumbnail + min price + stock summary, khong can full variants.

### Step 7: Cart

- Them `variantId` vao `CartItemRequest`.
- Them `variant` vao `CartItem`.
- Sua add/update cart.
- Sua cart response.

### Step 8: Order

- Them snapshot fields vao `OrderItem`.
- Sua checkout de tru stock variant.
- Sua cancel/refund neu co de cong lai stock variant.
- Sua order response dung snapshot.

### Step 9: Tests

- Test product simple van hoat dong.
- Test tao option group/value.
- Test tao variant thanh cong.
- Test SKU duplicate trong product.
- Test option value khong thuoc product.
- Test 2 values cung option group trong 1 variant.
- Test duplicate combination.
- Test imageId khong thuoc product.
- Test add cart variable khong co variantId.
- Test checkout tru stock variant.

---

## 11. Checklist hoan thanh

- [ ] Tao `ProductType`.
- [ ] Them `productType`, `optionGroups`, `variants` vao Product.
- [ ] Tao `ProductOptionGroup`.
- [ ] Tao `ProductOptionValue`.
- [ ] Tao `ProductVariant`.
- [ ] Tao repositories.
- [ ] Tao DTO option/variant.
- [ ] Tao mapper option/variant/product/cart/order.
- [ ] Tao `OwnershipService`.
- [ ] Tao `ProductOptionService`.
- [ ] Tao `ProductVariantValidator`.
- [ ] Tao `ProductVariantService`.
- [ ] Tao `ProductVariantSyncService`.
- [ ] Tao controllers cho option/variant.
- [ ] Cap nhat `ProductResponse`.
- [ ] Cap nhat `CartItemRequest`, `CartItem`, `CartService`, `CartItemResponse`.
- [ ] Cap nhat `OrderItem`, `OrderService`, `OrderItemResponse`.
- [ ] Them tests cho business rules quan trong.

---

## 12. Nhung viec khong lam trong phase nay

De phase khong bi qua lon, tam thoi chua lam:

- Discount/voucher theo variant.
- Bulk import variants tu Excel.
- Auto generate tat ca variant combinations.
- Multiple shops per user.
- Shipping/tracking strategy.
- Payment strategy.
- Inventory reservation/hold stock.

Nhung design hien tai se khong chan cac phase do.

---

## 13. Ket luan kien truc

Huong moi cua phase nay:

```text
ProductService       -> product cha
ProductOptionService -> option groups/values
ProductVariantService -> SKU, price, stock, selected options
ImageService         -> product/variant images
CartService          -> resolve product/variant khi mua
OrderService         -> snapshot product/variant khi checkout
```

Pattern uu tien:

```text
1. Mapper Pattern
2. Validator / Policy Pattern
3. Ownership Service helper
4. Resolver/helper cho price-stock-image
5. Factory nhe, optional
```

Khong nen day toan bo logic variant vao `ProductServiceImpl` hoac `ProductFactory`. Service dieu phoi transaction, validator giu rule, mapper giu DTO, factory neu co chi build object.
