Read [](file:///home/hai/xv6/xv6-labs-2024/user/find.c)

## Phân tích chi tiết XARGS

### **Mục đích của xargs:**
`xargs` đọc dữ liệu từ stdin (đầu vào chuẩn), chia thành các tham số và thực thi một lệnh với các tham số đó. Ví dụ: `echo "a b c" | xargs mkdir` sẽ tạo 3 thư mục a, b, c.

### **Giải thích từng dòng code:**

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/param.h"    // Chứa MAXARG - số lượng tham số tối đa
```

```c
#define is_blank(chr) (chr == ' ' || chr == '\t')  
// Macro kiểm tra ký tự có phải khoảng trắng (space hoặc tab)
```

```c
char buf[2048], ch;           // buf: lưu tất cả tham số, ch: đọc từng ký tự
char *p = buf;                // p: con trỏ trỏ đến vị trí bắt đầu tham số hiện tại
char *v[MAXARG];              // v: mảng con trỏ lưu các tham số (argv)
int c;                        // c: đếm số lượng tham số trong v
int blanks = 0;               // blanks: đếm số khoảng trắng liên tiếp
int offset = 0;               // offset: vị trí hiện tại trong buf
```

```c
if(argc <= 1){
    fprintf(2, "usage: xargs <command> [argv...]\n");
    exit(1);
}
// Kiểm tra phải có ít nhất 1 tham số (lệnh cần thực thi)
```

```c
for (c = 1; c < argc; c++) {
    v[c-1] = argv[c];         // Copy các tham số từ dòng lệnh vào v
}                             // Ví dụ: "xargs mkdir" → v[0] = "mkdir"
--c;                          // c giờ trỏ đến vị trí sau tham số cuối
```

```c
while (read(0, &ch, 1) > 0) { // Đọc từng ký tự từ stdin
```

**Xử lý khoảng trắng:**
```c
if (is_blank(ch)) {
    blanks++;                 // Đếm khoảng trắng
    continue;                 // Bỏ qua, không lưu vào buf
}
```

**Kết thúc một tham số khi gặp khoảng trắng:**
```c
if (blanks) {                 // Nếu vừa gặp khoảng trắng
    buf[offset++] = 0;        // Thêm null terminator kết thúc chuỗi
    
    v[c++] = p;               // Lưu con trỏ tham số vừa kết thúc vào v
    p = buf + offset;         // p trỏ đến vị trí bắt đầu tham số mới
    
    blanks = 0;               // Reset đếm khoảng trắng
}
```

**Xử lý ký tự thường và newline:**
```c
if (ch != '\n') {
    buf[offset++] = ch;       // Thêm ký tự vào buf
} else {
    // Gặp newline → kết thúc dòng lệnh, thực thi
    buf[offset++] = 0;        // Null terminator cho tham số cuối
    v[c++] = p;               // Lưu tham số cuối vào v
    v[c] = 0;                 // Null terminator cho mảng v (bắt buộc với exec)
    
    if (!fork()) {            // Tạo tiến trình con
        exit(exec(v[0], v));  // Thực thi lệnh, thoát nếu thất bại
    }
    wait(0);                  // Tiến trình cha đợi con hoàn thành
    
    c = argc - 1;             // Reset số tham số về ban đầu
    offset = 0;               // Reset buffer
    p = buf;                  // Reset con trỏ về đầu buffer
}
```

### **Ví dụ hoạt động:**
```bash
echo "a b" | xargs mkdir
```
1. `v[0] = "mkdir"` (từ argv)
2. Đọc 'a' → lưu vào buf
3. Gặp ' ' → thêm '\0', `v[1]` trỏ đến "a"
4. Đọc 'b' → lưu vào buf
5. Gặp '\n' → thêm '\0', `v[2]` trỏ đến "b", `v[3] = 0`
6. Thực thi: `exec("mkdir", ["mkdir", "a", "b", 0])`

---

## Phân tích chi tiết FIND

### **Mục đích của find:**
Tìm kiếm file theo tên trong cây thư mục, đệ quy vào các thư mục con.

### **Giải thích từng phần:**

**Hàm fmtname - Lấy tên file từ đường dẫn:**
```c
char* fmtname(char *path)
{
  static char buf[DIRSIZ+1];  // Buffer tĩnh lưu tên file
  char *p;

  // Tìm ký tự '/' cuối cùng trong path
  for(p=path+strlen(path); p >= path && *p != '/'; p--)
    ;
  p++;                        // p giờ trỏ đến tên file

  if(strlen(p) >= DIRSIZ)     // Nếu tên dài, trả về trực tiếp
    return p;
  
  memmove(buf, p, strlen(p)); // Copy tên vào buf
  memset(buf+strlen(p), '\0', DIRSIZ-strlen(p)); // Padding null
  return buf;
}
```

**Hàm find - Tìm kiếm đệ quy:**
```c
void find(char* path, char* file_name)
{
  char buf[512], *p;          // buf: lưu đường dẫn đầy đủ
  int fd;
  struct dirent de;           // Entry trong thư mục (tên + inode)
  struct stat st;             // Thông tin file (type, size...)
```

```c
  if(strlen(path) + 1 + DIRSIZ + 1 > 512){
    fprintf(2, "find: path too long\n");
    return;
  }
  // Kiểm tra đường dẫn không quá dài
```

```c
  if((fd = open(path, 0)) < 0){
    fprintf(2, "find: path %s does not exist\n", path);
    return;
  }
  // Mở thư mục
```

```c
  if(fstat(fd, &st) < 0){
    fprintf(2, "find: unknown path %s\n", path);
    close(fd);
    return;
  }
  // Lấy thông tin thư mục
```

```c
  strcpy(buf, path);
  p = buf + strlen(buf);
  *p++ = '/';
  // Chuẩn bị buf = "path/" để nối tên file
```

```c
  while(read(fd, &de, sizeof(de)) == sizeof(de)){
    // Đọc từng entry trong thư mục
    
    if(de.inum == 0)
      continue;               // Bỏ qua entry rỗng
    
    memmove(p, de.name, DIRSIZ);
    p[DIRSIZ] = 0;            // buf giờ = "path/filename"
    
    if(stat(buf, &st) < 0){
      printf("find: cannot stat %s\n", buf);
      continue;
    }
```

```c
    if (st.type == T_FILE){
      // Nếu là file → so sánh tên
      if (strcmp(fmtname(buf), file_name) == 0) {
        printf("%s\n", buf);  // In ra nếu trùng tên
      }
    }
```

```c
    else if (st.type == T_DIR){
      // Nếu là thư mục → đệ quy
      if (strcmp(fmtname(buf), ".") != 0 && 
          strcmp(fmtname(buf), "..") != 0) {
        // Bỏ qua "." và ".." để tránh vòng lặp vô hạn
        int fd2 = open(buf, 0);
        find(buf, file_name);  // Gọi đệ quy
        close(fd2);
      }
    }
  }
  close(fd);
}
```

### **Ví dụ hoạt động find:**
```bash
find . b
```
1. Mở thư mục "."
2. Đọc entry "a" (thư mục) → đệ quy vào "a"
3. Trong "a", tìm thấy file "b" → in "./a/b"
4. Tiếp tục các entry khác...

**Điểm quan trọng:** 
- `xargs` dùng `fork()` và `exec()` để chạy lệnh với mỗi batch tham số
- `find` dùng đệ quy để duyệt cây thư mục, bỏ qua "." và ".." để tránh loop
