Để giải thích các file đã thay đổi cho "speed up system call", tôi cần đọc các file liên quan: 

Searched for regex `usyscall|USYSCALL|ugetpid`, no results

Read [](file:///home/hai/lab2/os-project2/kernel/memlayout.h)

Read [](file:///home/hai/lab2/os-project2/kernel/proc.h)

Read [](file:///home/hai/lab2/os-project2/kernel/proc.c#1-1), lines 1 to 250

Tôi thấy workspace này **chưa có implementation** cho "speed up system call". Đây là code xv6 gốc chưa được modify. Hãy để tôi giải thích **ý tưởng và các thay đổi cần thiết** để thực hiện "speed up system call":

---

## 🚀 Giải thích "Speed Up System Call" trong xv6

### **Ý tưởng chính**

Thông thường, mỗi lần gọi `getpid()`, process phải:
1. Chuyển từ user mode → kernel mode (trap)
2. Kernel xử lý system call
3. Chuyển từ kernel mode → user mode

Đây là **overhead lớn** cho các system call đơn giản như `getpid()`.

**Giải pháp**: Chia sẻ một trang bộ nhớ **read-only** giữa kernel và user space, chứa thông tin process (như `pid`). User có thể đọc trực tiếp mà **không cần trap vào kernel**.

---

### **Các file cần thay đổi**

#### 1. **memlayout.h** - Định nghĩa địa chỉ USYSCALL

```c
// Thêm định nghĩa struct và địa chỉ
#define USYSCALL (TRAPFRAME - PGSIZE)

struct usyscall {
  int pid;  // Process ID được cache ở đây
};
```
- `USYSCALL` nằm ngay dưới `TRAPFRAME` trong virtual address space
- Struct chứa `pid` để user đọc trực tiếp

---

#### 2. **proc.h** - Thêm pointer vào struct proc

```c
struct proc {
  // ... các field khác ...
  struct trapframe *trapframe;
  struct usyscall *usyscall;    // ← THÊM DÒNG NÀY
  // ...
};
```
- Mỗi process có pointer đến trang `usyscall` của nó

---

#### 3. **proc.c** - Allocate và free trang USYSCALL

**Trong `allocproc()`:**
```c
// Allocate usyscall page
if((p->usyscall = (struct usyscall *)kalloc()) == 0){
  freeproc(p);
  release(&p->lock);
  return 0;
}
p->usyscall->pid = p->pid;  // Lưu pid vào trang này
```

**Trong `freeproc()`:**
```c
if(p->usyscall)
  kfree((void*)p->usyscall);
p->usyscall = 0;
```

**Trong `proc_pagetable()`:**
```c
// Map trang USYSCALL với quyền PTE_R | PTE_U (read-only cho user)
if(mappages(pagetable, USYSCALL, PGSIZE,
            (uint64)(p->usyscall), PTE_R | PTE_U) < 0){
  // cleanup...
  return 0;
}
```

**Trong `proc_freepagetable()`:**
```c
uvmunmap(pagetable, USYSCALL, 1, 0);  // Unmap khi free
```

---

#### 4. **ulib.c** hoặc **user.h** - Hàm ugetpid()

```c
#include "kernel/memlayout.h"

int ugetpid(void) {
  struct usyscall *u = (struct usyscall *)USYSCALL;
  return u->pid;  // Đọc trực tiếp từ bộ nhớ, không cần syscall!
}
```

---

### **Tóm tắt luồng hoạt động**

```
┌─────────────────────────────────────────────────────┐
│                  User Virtual Memory                 │
├─────────────────────────────────────────────────────┤
│  TRAMPOLINE  │ Kernel trampoline code               │
├──────────────┼──────────────────────────────────────┤
│  TRAPFRAME   │ Saved registers khi trap             │
├──────────────┼──────────────────────────────────────┤
│  USYSCALL    │ { pid: 123 }  ← User đọc trực tiếp!  │
├──────────────┼──────────────────────────────────────┤
│     ...      │ User heap, stack, code               │
└─────────────────────────────────────────────────────┘
```

1. Khi process được tạo, kernel allocate trang `USYSCALL` và ghi `pid` vào đó
2. Trang được map với quyền **PTE_R | PTE_U** (read-only cho user)
3. User gọi `ugetpid()` → đọc trực tiếp từ địa chỉ `USYSCALL` → **không cần trap!**

---

### **Lợi ích**

| Cách cũ (getpid syscall) | Cách mới (ugetpid) |
|--------------------------|-------------------|
| ~100-1000 cycles (trap overhead) | ~10 cycles (memory read) |
| Context switch user↔kernel | Không cần switch |

Kỹ thuật này tương tự **vDSO (virtual Dynamic Shared Object)** trong Linux kernel.
