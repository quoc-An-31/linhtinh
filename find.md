# GIẢI THÍCH CHI TIẾT FIND VÀ XARGS - XV6 LAB

## 1. CHƯƠNG TRÌNH FIND

### 1.1. LOGIC TỔNG QUAN

**Mục đích:** Tìm kiếm file theo tên trong cây thư mục, đệ quy vào các thư mục con.

**Cách hoạt động:**
1. Nhận đường dẫn bắt đầu và tên file cần tìm
2. Mở thư mục và đọc từng entry (file/thư mục)
3. Nếu là file → so sánh tên, nếu trùng thì in ra
4. Nếu là thư mục → gọi đệ quy để tìm trong thư mục đó
5. Bỏ qua "." và ".." để tránh vòng lặp vô hạn

### 1.2. GIẢI THÍCH CHI TIẾT CODE

#### **Hàm fmtname() - Trích xuất tên file từ đường dẫn**

```c
char* fmtname(char *path)
{
  static char buf[DIRSIZ+1];  // Buffer tĩnh lưu tên file (DIRSIZ = 14 bytes)
  char *p;

  // Tìm ký tự '/' cuối cùng trong path để lấy tên file
  for(p=path+strlen(path); p >= path && *p != '/'; p--)
    ;
  p++;  // p giờ trỏ đến ký tự đầu tiên của tên file

  // Nếu tên file dài hơn DIRSIZ, trả về trực tiếp
  if(strlen(p) >= DIRSIZ)
    return p;
  
  // Copy tên file vào buf và padding null bytes
  memmove(buf, p, strlen(p));
  memset(buf+strlen(p), '\0', DIRSIZ-strlen(p));
  return buf;
}
```

**Ví dụ:**
- Input: `"./a/b/file.txt"` → Output: `"file.txt"`
- Input: `"./dir"` → Output: `"dir"`

---

#### **Hàm find() - Tìm kiếm đệ quy**

```c
void find(char* path, char* file_name)
{
  char buf[512], *p;          // buf: lưu đường dẫn đầy đủ khi nối path + filename
  int fd;                      // File descriptor của thư mục
  struct dirent de;           // Entry trong thư mục (inode number + tên)
  struct stat st;             // Thông tin file (type, size, inode...)
```

**Bước 1: Kiểm tra độ dài đường dẫn**
```c
  if(strlen(path) + 1 + DIRSIZ + 1 > 512){
    fprintf(2, "find: path too long\n");
    return;
  }
  // Đảm bảo: path + "/" + filename + "\0" không vượt quá 512 bytes
```

**Bước 2: Mở thư mục**
```c
  if((fd = open(path, 0)) < 0){
    fprintf(2, "find: path %s does not exist\n", path);
    return;
  }
  // open() trả về file descriptor, -1 nếu lỗi
```

**Bước 3: Lấy thông tin thư mục**
```c
  if(fstat(fd, &st) < 0){
    fprintf(2, "find: unknown path %s\n", path);
    close(fd);
    return;
  }
  // fstat() lấy metadata của file/thư mục (type, size, permissions...)
```

**Bước 4: Chuẩn bị buffer để nối đường dẫn**
```c
  strcpy(buf, path);           // buf = "."
  p = buf + strlen(buf);       // p trỏ đến cuối buf
  *p++ = '/';                  // buf = "./" và p trỏ đến vị trí sau '/'
  // Giờ có thể nối tên file: buf = "./" + filename
```

**Bước 5: Đọc và xử lý từng entry trong thư mục**
```c
  while(read(fd, &de, sizeof(de)) == sizeof(de)){
    // read() đọc 1 struct dirent mỗi lần (16 bytes: 2 bytes inode + 14 bytes tên)
    
    if(de.inum == 0)
      continue;  // Entry rỗng (đã bị xóa), bỏ qua
    
    // Nối tên file vào buf
    memmove(p, de.name, DIRSIZ);  // buf = "./filename"
    p[DIRSIZ] = 0;                 // Đảm bảo null terminator
    
    // Lấy thông tin của file/thư mục này
    if(stat(buf, &st) < 0){
      printf("find: cannot stat %s\n", buf);
      continue;
    }
```

**Bước 6: Xử lý theo loại (File hoặc Directory)**
```c
    if (st.type == T_FILE){
      // Nếu là file → so sánh tên
      if (strcmp(fmtname(buf), file_name) == 0) {
        printf("%s\n", buf);  // Tìm thấy! In ra đường dẫn đầy đủ
      }
    }
    else if (st.type == T_DIR){
      // Nếu là thư mục → đệ quy
      if (strcmp(fmtname(buf), ".") != 0 && 
          strcmp(fmtname(buf), "..") != 0) {
        // Bỏ qua "." (thư mục hiện tại) và ".." (thư mục cha)
        // để tránh vòng lặp vô hạn
        
        int fd2 = open(buf, 0);  // Mở thư mục con
        find(buf, file_name);     // GỌI ĐỆ QUY
        close(fd2);
      }
    }
  }
  close(fd);  // Đóng file descriptor
}
```

### 1.3. VÍ DỤ HOẠT ĐỘNG

**Lệnh:** `find . b`

**Cây thư mục:**
```
.
├── a/
│   └── b
├── c/
│   └── b
└── b
```

**Trình tự thực thi:**
1. `find(".", "b")` - Bắt đầu từ thư mục hiện tại
2. Đọc entry "a" (thư mục) → `find("./a", "b")` (đệ quy)
   - Đọc entry "b" (file) → So sánh → **In ra: "./a/b"**
3. Quay lại, đọc entry "c" (thư mục) → `find("./c", "b")` (đệ quy)
   - Đọc entry "b" (file) → So sánh → **In ra: "./c/b"**
4. Quay lại, đọc entry "b" (file) → So sánh → **In ra: "./b"**

**Kết quả:**
```
./a/b
./c/b
./b
```

---

## 2. CHƯƠNG TRÌNH XARGS

### 2.1. LOGIC TỔNG QUAN

**Mục đích:** Đọc dữ liệu từ stdin, chia thành các đối số và thực thi lệnh với các đối số đó.

**Cách hoạt động:**
1. Parse các tham số từ command line (lệnh cần chạy + option `-n`)
2. Đọc từng ký tự từ stdin
3. Phân tích ký tự: khoảng trắng (phân cách đối số) hoặc newline (kết thúc lệnh)
4. Lưu các đối số vào buffer và mảng con trỏ
5. Khi đủ điều kiện (đủ số đối số hoặc gặp newline), fork + exec để chạy lệnh
6. Reset và tiếp tục đọc

### 2.2. GIẢI THÍCH CHI TIẾT CODE

#### **Phần 1: Khai báo biến**

```c
char buf[2048], ch;         // buf: lưu tất cả đối số dạng chuỗi liên tục
                            // ch: đọc từng ký tự từ stdin

char *p = buf;              // p: con trỏ trỏ đến vị trí bắt đầu đối số hiện tại

char *v[MAXARG];            // v: mảng con trỏ trỏ đến các đối số (giống argv[])
                            // v[0] = lệnh, v[1..n] = đối số

int c;                      // c: số lượng đối số hiện có trong v

int blanks = 0;             // blanks: đếm số khoảng trắng liên tiếp
                            // Dùng để phát hiện khi nào kết thúc 1 đối số

int offset = 0;             // offset: vị trí hiện tại trong buf

int max_args = -1;          // max_args: số đối số tối đa mỗi lần exec (từ -n)
                            // -1 = không giới hạn, chờ đến newline

int base_argc = 0;          // base_argc: số đối số gốc từ command line
                            // Ví dụ: "xargs echo bye" → base_argc = 2
```

#### **Phần 2: Parse option `-n`**

```c
int arg_start = 1;
if(argc > 2 && strcmp(argv[1], "-n") == 0){
    max_args = atoi(argv[2]);  // Chuyển "1" thành số 1
    arg_start = 3;              // Bỏ qua "-n" và "1"
}
```

**Ví dụ:**
- `xargs echo` → `arg_start = 1`, `max_args = -1`
- `xargs -n 1 echo` → `arg_start = 3`, `max_args = 1`

#### **Phần 3: Copy đối số từ command line vào mảng v**

```c
for (c = arg_start; c < argc; c++) {
    v[base_argc++] = argv[c];  // Lưu con trỏ vào v
}
c = base_argc;  // c giờ = số lượng đối số gốc
```

**Ví dụ:**
- `xargs echo bye` → `v[0] = "echo"`, `v[1] = "bye"`, `base_argc = 2`
- `xargs -n 1 mkdir` → `v[0] = "mkdir"`, `base_argc = 1`

#### **Phần 4: Đọc và xử lý từng ký tự từ stdin**

**4.1. Xử lý khoảng trắng (space/tab):**
```c
while (read(0, &ch, 1) > 0) {  // Đọc 1 byte từ stdin (fd=0)
    if (is_blank(ch)) {         // Nếu là space hoặc tab
        blanks++;               // Tăng biến đếm khoảng trắng
        continue;               // Bỏ qua, không lưu vào buf
    }
```

**4.2. Kết thúc 1 đối số khi gặp ký tự thường sau khoảng trắng:**
```c
    if (blanks) {  // Nếu trước đó có khoảng trắng
        buf[offset++] = 0;      // Thêm null terminator kết thúc đối số trước
        
        v[c++] = p;             // Lưu con trỏ đối số vừa kết thúc vào v
        p = buf + offset;       // p trỏ đến vị trí bắt đầu đối số mới
        
        blanks = 0;             // Reset đếm khoảng trắng
```

**Minh họa bằng memory:**
```
Input: "hello world"

Sau khi đọc "hello ":
buf:  ['h']['e']['l']['l']['o']['\0']
       ^                           ^
       |                           |
     v[1]                          p (vị trí tiếp theo)

Sau khi đọc "world":
buf:  ['h']['e']['l']['l']['o']['\0']['w']['o']['r']['l']['d']
       ^                           ^
       |                           |
     v[1]="hello"                v[2]="world" (chưa kết thúc)
```

**4.3. Kiểm tra xem đã đủ số đối số chưa (với option -n):**
```c
        // Nếu đã đủ số lượng args theo -n, thực thi ngay
        if(max_args > 0 && (c - base_argc) >= max_args){
            v[c] = 0;           // Null terminator cho mảng v (BẮT BUỘC với exec)
            
            if (!fork()) {      // Tạo tiến trình con
                exit(exec(v[0], v));  // Con: thực thi lệnh
            }
            wait(0);            // Cha: đợi con hoàn thành
            
            // Reset về trạng thái ban đầu
            c = base_argc;      // Giữ lại các đối số gốc
            offset = 0;         // Reset buffer
            p = buf;            // p trỏ về đầu buffer
        }
    }
```

**4.4. Xử lý ký tự thường và newline:**
```c
    if (ch != '\n') {
        buf[offset++] = ch;     // Thêm ký tự vào buffer
    } else {
        // Gặp newline → kết thúc dòng lệnh, thực thi
        buf[offset++] = 0;      // Null terminator cho đối số cuối cùng
        v[c++] = p;             // Lưu đối số cuối vào v
        v[c] = 0;               // Null terminator cho mảng v
        
        if (!fork()) {          // Tạo tiến trình con
            exit(exec(v[0], v));  // Thực thi lệnh
        }
        wait(0);                // Đợi con hoàn thành
        
        // Reset về trạng thái ban đầu để xử lý dòng tiếp theo
        c = base_argc;
        offset = 0;
        p = buf;
    }
}
```

### 2.3. VÍ DỤ HOẠT ĐỘNG CHI TIẾT

#### **Ví dụ 1: `echo "a b" | xargs mkdir`**

**Khởi tạo:**
- `v[0] = "mkdir"`, `base_argc = 1`, `c = 1`

**Xử lý từng ký tự:**
1. Đọc `'a'` → `buf[0] = 'a'`, `offset = 1`
2. Đọc `' '` → `blanks = 1`, bỏ qua
3. Đọc `'b'` → Phát hiện `blanks = 1`
   - `buf[1] = '\0'` (kết thúc "a")
   - `v[1] = &buf[0]` (trỏ đến "a")
   - `p = &buf[2]`
   - `buf[2] = 'b'`, `offset = 3`
4. Đọc `'\n'` → Kết thúc lệnh
   - `buf[3] = '\0'` (kết thúc "b")
   - `v[2] = &buf[2]` (trỏ đến "b")
   - `v[3] = 0`
   - **Thực thi:** `exec("mkdir", ["mkdir", "a", "b", NULL])`

**Kết quả:** Tạo 2 thư mục `a` và `b`

---

#### **Ví dụ 2: `(echo 1 ; echo 2) | xargs -n 1 echo`**

**Khởi tạo:**
- `v[0] = "echo"`, `base_argc = 1`, `max_args = 1`

**Lần 1:**
1. Đọc `'1'` → `buf[0] = '1'`, `offset = 1`
2. Đọc `'\n'` → Kết thúc lệnh
   - `buf[1] = '\0'`
   - `v[1] = &buf[0]` (trỏ đến "1")
   - `v[2] = 0`
   - `c - base_argc = 2 - 1 = 1` ≥ `max_args` ✓
   - **Thực thi:** `exec("echo", ["echo", "1", NULL])`
   - **In ra:** `1`
   - Reset: `c = 1`, `offset = 0`

**Lần 2:**
1. Đọc `'2'` → `buf[0] = '2'`, `offset = 1`
2. Đọc `'\n'` → Kết thúc lệnh
   - `buf[1] = '\0'`
   - `v[1] = &buf[0]` (trỏ đến "2")
   - `v[2] = 0`
   - **Thực thi:** `exec("echo", ["echo", "2", NULL])`
   - **In ra:** `2`

**Kết quả cuối:**
```
1
2
```

---

#### **Ví dụ 3: `echo hello too | xargs echo bye`**

**Khởi tạo:**
- `v[0] = "echo"`, `v[1] = "bye"`, `base_argc = 2`, `c = 2`

**Xử lý:**
1. Đọc `"hello"` → `buf = "hello"`, `offset = 5`
2. Đọc `' '` → `blanks = 1`
3. Đọc `'t'` → Phát hiện khoảng trắng
   - `buf[5] = '\0'` (kết thúc "hello")
   - `v[2] = &buf[0]` (trỏ đến "hello")
   - `p = &buf[6]`
4. Đọc `"too"` → `buf[6..8] = "too"`
5. Đọc `'\n'` → Kết thúc
   - `buf[9] = '\0'`
   - `v[3] = &buf[6]` (trỏ đến "too")
   - `v[4] = 0`
   - **Thực thi:** `exec("echo", ["echo", "bye", "hello", "too", NULL])`

**Kết quả:** `bye hello too`

### 2.4. ĐIỂM QUAN TRỌNG

1. **Null terminator cho exec():**
   - `v[c] = 0` là BẮT BUỘC vì `exec()` cần biết khi nào kết thúc mảng argv

2. **Fork + Exec pattern:**
   - `fork()` tạo tiến trình con giống hệt cha
   - `exec()` thay thế code của con bằng chương trình mới
   - Cha gọi `wait()` để đợi con hoàn thành

3. **Reset buffer:**
   - Sau mỗi lần exec, phải reset `offset` và `p` về đầu buffer
   - Giữ lại `base_argc` để không mất đối số gốc

4. **Option -n:**
   - Kiểm tra `(c - base_argc) >= max_args` để biết khi nào thực thi
   - Không cần chờ đến newline nếu đã đủ số đối số

---

## 3. SO SÁNH VÀ LIÊN KẾT

### 3.1. Sử dụng kết hợp

```bash
find . b | xargs grep hello
```

**Cách hoạt động:**
1. `find . b` tìm tất cả file tên "b" và in ra:
   ```
   ./a/b
   ./c/b
   ./b
   ```
2. Pipe chuyển output cho xargs
3. `xargs grep hello` đọc 3 dòng và thực thi:
   ```bash
   grep hello ./a/b ./c/b ./b
   ```
4. Tìm dòng chứa "hello" trong 3 file đó

### 3.2. Đệ quy trong find vs Lặp trong xargs

- **find:** Dùng đệ quy để duyệt cây thư mục (DFS - Depth First Search)
- **xargs:** Dùng vòng lặp để đọc input và xử lý tuần tự

### 3.3. Quản lý bộ nhớ

- **find:** Dùng call stack cho đệ quy, có thể bị stack overflow nếu cây quá sâu
- **xargs:** Dùng buffer cố định 2048 bytes, giới hạn độ dài input

---

## 4. LƯU Ý KHI LÀM LAB

1. **Test case quan trọng:**
   - File có tên giống nhau ở nhiều thư mục
   - Thư mục lồng nhau nhiều cấp
   - Đường dẫn dài
   - Input có nhiều khoảng trắng liên tiếp

2. **Debug tips:**
   - In ra các biến `c`, `base_argc`, `offset` để kiểm tra
   - In ra `v[]` trước khi exec để xem mảng argv
   - Test từng case nhỏ trước khi test case phức tạp

3. **Lỗi thường gặp:**
   - Quên null terminator → exec fail
   - Không reset buffer → đối số bị trùng lặp
   - Không kiểm tra "." và ".." → vòng lặp vô hạn trong find
   - Tính toán `base_argc` sai → mất đối số gốc

---

**Chúc bạn làm lab thành công! 🎉**
