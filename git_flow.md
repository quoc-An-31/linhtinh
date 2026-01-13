# 🔀 CHIẾN LƯỢC GIT WORKFLOW - SPRINT 3

> **Hướng dẫn commit và branching cho các task Sprint 3**  
> **Cập nhật:** Support multiple payment methods (MoMo, ZaloPay, VNPay, Cash)

---

## 📋 MỤC LỤC

- [Chiến lược Branching](#-chiến-lược-branching)
- [Quy ước Commit Message](#-quy-ước-commit-message)
- [Commit Strategy theo từng Task](#-commit-strategy-theo-từng-task)
- [Pull Request Workflow](#-pull-request-workflow)
- [Checklist Code Review](#-checklist-code-review)

---

## 🌿 BRANCHING STRATEGY

### **Branch Structure:**

```
main (production)
  ↓
develop (integration)
  ↓
sprint-3 (sprint branch)
  ↓
feature branches (task-specific)
```

### **Branch Naming Convention:**

```bash
# Feature branches
feature/sprint3-task-3.1-payment-gateway
feature/sprint3-task-3.2-payment-records
feature/sprint3-task-3.3-super-admin-backend
feature/sprint3-task-3.4-advanced-reports
feature/sprint3-task-3.5-super-admin-ui
feature/sprint3-task-3.6-advanced-reports-ui
feature/sprint3-task-3.7-testing

# Bugfix branches
bugfix/payment-callback-signature-validation
bugfix/momo-webhook-timeout

# Hotfix branches (for production)
hotfix/payment-gateway-critical-fix
```

---

## 📝 COMMIT MESSAGE CONVENTION

### **Format:**

```
<type>(<scope>): <subject>

<body (optional)>

<footer (optional)>
```

### **Types:**

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(payment): add MoMo gateway integration` |
| `fix` | Bug fix | `fix(payment): handle webhook timeout` |
| `docs` | Documentation | `docs(readme): update payment setup guide` |
| `style` | Code style (formatting) | `style(payment): format code with prettier` |
| `refactor` | Code refactoring | `refactor(payment): extract signature generation` |
| `test` | Add/update tests | `test(payment): add unit tests for MoMo service` |
| `chore` | Maintenance tasks | `chore(deps): update payment SDK version` |
| `perf` | Performance improvement | `perf(payment): optimize callback processing` |
| `build` | Build system changes | `build(docker): add payment service container` |
| `ci` | CI/CD changes | `ci(github): add payment integration tests` |

### **Scopes (Sprint 3):**

- `payment` - Payment gateway tasks
- `super-admin` - Super admin features
- `reports` - Advanced reports
- `testing` - Testing tasks
- `database` - Database migrations
- `docs` - Documentation

### **Examples:**

```bash
# Good commits
feat(payment): implement MoMo payment gateway service
feat(payment): add payment callback handler
fix(payment): validate MoMo signature correctly
test(payment): add integration tests for payment flow
docs(payment): add MoMo setup instructions

# Bad commits
"update code"
"fix bug"
"changes"
"wip"
```

---

## 🎯 COMMIT STRATEGY PER TASK

### **TASK 3.1: Tích hợp Cổng Thanh toán (12-16 giờ)**

**Branch:** `feature/sprint3-task-3.1-payment-gateway`

**Commit Plan (12-14 commits):**

```bash
# 1. Setup Module
git checkout -b feature/sprint3-task-3.1-payment-gateway develop
git commit -m "feat(payment): tạo cấu trúc module payments"

# 2. Database Schema
git commit -m "feat(database): thêm bảng payments và payment_methods"
git commit -m "feat(database): seed payment methods (momo, zalopay, vnpay, cash)"

# 3. MoMo Service
git commit -m "feat(payment): implement MoMo service với signature generation"
git commit -m "feat(payment): thêm MoMo callback handler"

# 4. ZaloPay Service
git commit -m "feat(payment): implement ZaloPay service với MAC generation"
git commit -m "feat(payment): thêm ZaloPay callback handler"

# 5. VNPay Service
git commit -m "feat(payment): implement VNPay service với SecureHash"
git commit -m "feat(payment): thêm VNPay IPN handler"

# 6. Cash Payment
git commit -m "feat(payment): implement cash payment handler"
git commit -m "feat(payment): thêm waiter confirmation cho cash payment"

# 7. Payment Controller & Integration
git commit -m "feat(payment): tạo payment controller với role guards"
git commit -m "feat(payment): tích hợp payments với orders service"

# 8. Testing
git commit -m "test(payment): thêm unit tests cho payment services"
git commit -m "test(payment): thêm integration tests cho payment flow"

# 9. Documentation
git commit -m "docs(payment): viết hướng dẫn setup các payment gateways"
```

**Thời gian mỗi commit:** ~1-1.5 giờ

---

### **TASK 3.2: Quản lý Thanh toán & Hoàn tiền (8-10 giờ)**

**Branch:** `feature/sprint3-task-3.2-payment-records`

**Commit Plan (8-10 commits):**

```bash
git checkout -b feature/sprint3-task-3.2-payment-records develop

# 1. Payment Listing
git commit -m "feat(payment): thêm API listing payments với filters"
git commit -m "feat(payment): implement search by order/date/method"
git commit -m "feat(payment): thêm pagination cho payment list"

# 2. Refund cho Online Payments
git commit -m "feat(payment): implement refund cho MoMo payments"
git commit -m "feat(payment): implement refund cho ZaloPay payments"
git commit -m "feat(payment): implement refund cho VNPay payments"

# 3. Refund cho Cash Payments
git commit -m "feat(payment): xử lý refund cho cash payments"
git commit -m "feat(payment): thêm waiter confirmation cho cash refund"

# 4. Analytics
git commit -m "feat(payment): thống kê revenue theo payment method"
git commit -m "feat(payment): tính success rate cho từng gateway"

# 5. Testing & Documentation
git commit -m "test(payment): thêm integration tests cho refund flow"
git commit -m "docs(payment): viết hướng dẫn refund process"
```

---

### **TASK 3.3: Super Admin Backend (6 giờ)**

**Branch:** `feature/sprint3-task-3.3-super-admin-backend`

**Commit Plan (5-6 commits):**

```bash
git checkout -b feature/sprint3-task-3.3-super-admin-backend develop

# 1. Module Setup
git commit -m "feat(super-admin): create super-admin module"

# 2. System Stats
git commit -m "feat(super-admin): implement system-wide statistics API"

# 3. Admin Management
git commit -m "feat(super-admin): add admin CRUD endpoints"
git commit -m "feat(super-admin): add admin deactivation logic"

# 4. Restaurant Overview
git commit -m "feat(super-admin): add restaurants overview with stats"

# 5. Testing
git commit -m "test(super-admin): add integration tests for APIs"
```

---

### **TASK 3.4: Advanced Reports (10 giờ)**

**Branch:** `feature/sprint3-task-3.4-advanced-reports`

**Commit Plan (7-9 commits):**

```bash
git checkout -b feature/sprint3-task-3.4-advanced-reports develop

# 1. Database Update
git commit -m "feat(database): add waiter_id field to orders table"

# 2. Revenue by Category
git commit -m "feat(reports): implement revenue by category analytics"

# 3. Waiter Performance
git commit -m "feat(reports): add waiter performance tracking"
git commit -m "feat(reports): calculate waiter metrics and rankings"

# 4. Kitchen Efficiency
git commit -m "feat(reports): add kitchen efficiency analytics"

# 5. Customer Retention
git commit -m "feat(reports): implement customer retention analysis"

# 6. Peak Hours
git commit -m "feat(reports): add peak hours analysis"

# 7. Testing
git commit -m "test(reports): add unit tests for analytics functions"
```

---

### **TASK 3.5: Super Admin UI (10 giờ)**

**Branch:** `feature/sprint3-task-3.5-super-admin-ui`

**Commit Plan (6-8 commits):**

```bash
git checkout -b feature/sprint3-task-3.5-super-admin-ui develop

# 1. Login Page
git commit -m "feat(super-admin): create super admin login page"
git commit -m "style(super-admin): add login page styling"

# 2. Dashboard
git commit -m "feat(super-admin): implement dashboard with system stats"
git commit -m "feat(super-admin): add charts for user distribution"

# 3. Admin Management
git commit -m "feat(super-admin): create admin management interface"
git commit -m "feat(super-admin): add create/deactivate admin forms"

# 4. Routing
git commit -m "feat(super-admin): add protected routes for super admin"

# 5. Integration
git commit -m "feat(super-admin): integrate with backend APIs"
```

---

### **TASK 3.6: Advanced Reports UI (8 giờ)**

**Branch:** `feature/sprint3-task-3.6-advanced-reports-ui`

**Commit Plan (5-7 commits):**

```bash
git checkout -b feature/sprint3-task-3.6-advanced-reports-ui develop

# 1. Tab Navigation
git commit -m "feat(reports): add basic/advanced reports tabs"

# 2. Category Revenue Chart
git commit -m "feat(reports): add revenue by category pie chart"
git commit -m "feat(reports): add category details table"

# 3. Waiter Performance
git commit -m "feat(reports): implement waiter leaderboard UI"

# 4. Kitchen & Customer Analytics
git commit -m "feat(reports): add kitchen efficiency dashboard"
git commit -m "feat(reports): add customer retention metrics UI"

# 5. Peak Hours
git commit -m "feat(reports): implement peak hours heatmap"
```

---

### **TASK 3.7: Testing & Bug Fixes (12 giờ)**

**Branch:** `feature/sprint3-task-3.7-testing`

**Commit Plan (8-10 commits):**

```bash
git checkout -b feature/sprint3-task-3.7-testing develop

# 1. Unit Tests
git commit -m "test(payment): add PaymentsService unit tests"
git commit -m "test(super-admin): add SuperAdminService unit tests"

# 2. Integration Tests
git commit -m "test(payment): add payment flow E2E tests"
git commit -m "test(reports): add advanced reports API tests"

# 3. Bug Fixes
git commit -m "fix(payment): handle signature validation errors"
git commit -m "fix(reports): fix date range filtering"

# 4. Performance
git commit -m "perf(reports): optimize database queries"
git commit -m "perf(payment): add caching for payment status"

# 5. Documentation
git commit -m "docs(testing): add testing guidelines"
git commit -m "docs(sprint3): update implementation status"
```

---

## 🔄 PULL REQUEST WORKFLOW

### **1. Before Creating PR:**

```bash
# Update from develop
git checkout develop
git pull origin develop

# Rebase your branch
git checkout feature/sprint3-task-3.1-payment-gateway
git rebase develop

# Run tests
npm run test
npm run lint

# Push to remote
git push origin feature/sprint3-task-3.1-payment-gateway
```

### **2. PR Template:**

```markdown
## 📋 Task Information
- **Task ID:** 3.1
- **Task Name:** Payment Gateway Integration
- **Estimated Time:** 12 hours
- **Actual Time:** 13 hours

## ✅ Changes Made
- Implemented MoMo payment gateway service
- Added payment callback handler
- Created payments table migration
- Added payment API endpoints
- Integrated with orders service

## 🧪 Testing
- [x] Unit tests passed (coverage: 85%)
- [x] Integration tests passed
- [x] Manual testing completed
- [x] Payment flow tested with MoMo sandbox

## 📸 Screenshots (if UI changes)
[Attach screenshots here]

## 🔗 Related Issues
Closes #123

## 📝 Checklist
- [x] Code follows project conventions
- [x] Documentation updated
- [x] Tests added/updated
- [x] No console.log() left in code
- [x] Environment variables documented
- [x] Database migrations tested
```

### **3. PR Review Process:**

```
Developer creates PR → Assign reviewer → Review → Request changes / Approve → Merge
```

**Merge Strategy:**
```bash
# Squash merge for feature branches
git checkout develop
git merge --squash feature/sprint3-task-3.1-payment-gateway
git commit -m "feat(payment): add MoMo payment gateway integration (#PR-number)"
git push origin develop
```

---

## ✅ CODE REVIEW CHECKLIST

### **Backend Code:**

- [ ] **Code Quality:**
  - [ ] No hardcoded values (use environment variables)
  - [ ] Error handling implemented
  - [ ] Input validation using DTOs
  - [ ] TypeScript types properly defined
  
- [ ] **Security:**
  - [ ] Sensitive data not logged
  - [ ] JWT authentication properly implemented
  - [ ] Role-based authorization working
  - [ ] SQL injection prevention (Prisma parameterized queries)
  - [ ] XSS prevention
  
- [ ] **Database:**
  - [ ] Migrations tested
  - [ ] Indexes added for performance
  - [ ] Foreign key constraints defined
  - [ ] No N+1 query problems
  
- [ ] **Testing:**
  - [ ] Unit tests for services
  - [ ] Integration tests for APIs
  - [ ] Test coverage > 70%

### **Frontend Code:**

- [ ] **Code Quality:**
  - [ ] Components properly structured
  - [ ] Props types defined (TypeScript)
  - [ ] No unused imports
  - [ ] Consistent naming conventions
  
- [ ] **Performance:**
  - [ ] Unnecessary re-renders avoided
  - [ ] Images optimized
  - [ ] Lazy loading implemented
  
- [ ] **UX:**
  - [ ] Loading states shown
  - [ ] Error messages user-friendly
  - [ ] Responsive design working
  - [ ] Accessibility considered

### **Documentation:**

- [ ] README updated if needed
- [ ] API endpoints documented
- [ ] Environment variables listed
- [ ] Setup instructions clear

---

## 📊 COMMIT FREQUENCY GUIDELINES

### **Recommended Commit Frequency:**

| Task Duration | Number of Commits | Avg Time per Commit |
|---------------|-------------------|---------------------|
| 6 giờ | 5-6 commits | ~1 giờ |
| 8 giờ | 6-8 commits | ~1 giờ |
| 10 giờ | 7-9 commits | ~1-1.5 giờ |
| 12 giờ | 8-10 commits | ~1-1.5 giờ |

### **Commit Best Practices:**

✅ **DO:**
- Commit working code only
- Make atomic commits (one logical change)
- Write descriptive commit messages
- Commit frequently (every 1-2 hours)
- Run tests before committing

❌ **DON'T:**
- Commit broken code
- Make huge commits (>500 lines changed)
- Use generic messages ("fix", "update")
- Commit sensitive data (.env files)
- Force push to shared branches

---

## 🚀 QUICK REFERENCE

### **Daily Workflow:**

```bash
# Morning: Start work on task
git checkout develop
git pull origin develop
git checkout -b feature/sprint3-task-3.x-feature-name

# During day: Commit frequently
git add .
git commit -m "feat(scope): descriptive message"

# End of day: Push backup
git push origin feature/sprint3-task-3.x-feature-name

# Task complete: Create PR
# Go to GitHub → New Pull Request → Fill template
```

### **Common Commands:**

```bash
# Check status
git status

# View commit history
git log --oneline --graph

# Amend last commit (if not pushed)
git commit --amend -m "new message"

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Stash changes temporarily
git stash
git stash pop

# Cherry-pick specific commit
git cherry-pick <commit-hash>
```

---

## 📈 SPRINT 3 PROGRESS TRACKING

### **Branch Merge Checklist:**

```
Sprint 3 Progress:
├─ [x] feature/sprint3-task-3.1-payment-gateway → develop
├─ [x] feature/sprint3-task-3.2-payment-records → develop
├─ [ ] feature/sprint3-task-3.3-super-admin-backend → develop
├─ [ ] feature/sprint3-task-3.4-advanced-reports → develop
├─ [ ] feature/sprint3-task-3.5-super-admin-ui → develop
├─ [ ] feature/sprint3-task-3.6-advanced-reports-ui → develop
└─ [ ] feature/sprint3-task-3.7-testing → develop

Final merge: sprint-3 → develop → main
```

### **Release Tagging:**

```bash
# After sprint complete
git checkout main
git tag -a v1.3.0 -m "Sprint 3: Payment Integration & Super Admin"
git push origin v1.3.0
```

---

## 🎯 SUCCESS METRICS

### **Good Git Hygiene:**

- ✅ All commits have meaningful messages
- ✅ Each PR has < 500 lines changed
- ✅ PRs reviewed within 24 hours
- ✅ No merge conflicts in develop
- ✅ All tests passing before merge
- ✅ Main branch always deployable

### **Sprint 3 Git Goals:**

- 📊 **Total Commits:** 50-60 commits
- 🔀 **Total PRs:** 7 PRs (one per task)
- ⏱️ **PR Review Time:** < 24 hours
- ✅ **Test Pass Rate:** 100%
- 🚀 **Deploy to Production:** Week 6 Friday

---

**🎉 Follow this workflow để maintain clean Git history và smooth collaboration!**
